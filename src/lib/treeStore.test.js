import { get } from 'svelte/store'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY, createTreeStore } from './treeStore'

function getState(store) {
  return get(store)
}

function getRootNode(state) {
  return state.doc.nodes[state.doc.rootId]
}

describe('treeStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts with a single main root node', () => {
    const store = createTreeStore()
    const state = getState(store)
    const root = getRootNode(state)

    expect(root.name).toBe('main')
    expect(root.parentId).toBe(null)
    expect(state.cursorId).toBe(state.doc.rootId)
  })

  it('restores document from localStorage when available', () => {
    const saved = {
      rootId: 'root',
      nodes: {
        root: {
          id: 'root',
          name: 'main',
          parentId: null,
          childrenIds: ['develop'],
        },
        develop: {
          id: 'develop',
          name: 'develop',
          parentId: 'root',
          childrenIds: [],
        },
      },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))

    const store = createTreeStore()
    const state = getState(store)

    expect(state.doc.rootId).toBe('root')
    expect(state.doc.nodes.develop.name).toBe('develop')
  })

  it('falls back to initial document when localStorage is corrupted', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem(STORAGE_KEY, '{broken')

    const store = createTreeStore()
    const state = getState(store)

    expect(getRootNode(state).name).toBe('main')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('adds nodes with Enter flow and starts editing immediately', () => {
    const store = createTreeStore()

    store.insertBelow()
    let state = getState(store)
    const firstChildId = state.cursorId

    expect(state.isEditing).toBe(true)

    store.setEditBuffer('develop')
    store.confirmEdit()
    store.insertBelow()
    state = getState(store)

    const root = getRootNode(state)
    expect(root.childrenIds).toEqual([firstChildId, state.cursorId])
  })

  it('indents to previous sibling with Tab and outdents with Shift+Tab', () => {
    const store = createTreeStore()

    store.insertBelow()
    const firstId = getState(store).cursorId
    store.setEditBuffer('develop')
    store.confirmEdit()

    store.insertBelow()
    const secondId = getState(store).cursorId
    store.setEditBuffer('feat-a')
    store.confirmEdit()

    store.indentRight()
    let state = getState(store)
    let root = getRootNode(state)

    expect(root.childrenIds).toEqual([firstId])
    expect(state.doc.nodes[firstId].childrenIds).toEqual([secondId])
    expect(state.doc.nodes[secondId].parentId).toBe(firstId)

    store.outdentLeft()
    state = getState(store)
    root = getRootNode(state)

    expect(root.childrenIds).toEqual([firstId, secondId])
    expect(state.doc.nodes[secondId].parentId).toBe(state.doc.rootId)
  })

  it('converts editing space input into Tab-like indent without adding space', () => {
    const store = createTreeStore()

    store.insertBelow()
    const firstId = getState(store).cursorId
    store.setEditBuffer('develop')
    store.confirmEdit()

    store.insertBelow()
    const secondId = getState(store).cursorId
    store.applyTypedChar(' ')

    const state = getState(store)
    const root = getRootNode(state)

    expect(root.childrenIds).toEqual([firstId])
    expect(state.doc.nodes[firstId].childrenIds).toEqual([secondId])
    expect(state.isEditing).toBe(true)
    expect(state.editBuffer).toBe('')
  })

  it('clears node name with delete behavior and keeps children', () => {
    const store = createTreeStore()

    store.insertBelow()
    const parentId = getState(store).cursorId
    store.setEditBuffer('develop')
    store.confirmEdit()

    store.insertBelow()
    const childId = getState(store).cursorId
    store.setEditBuffer('feat-a')
    store.confirmEdit()
    store.indentRight()

    store.selectCursor(parentId)
    store.clearName()

    const state = getState(store)
    expect(state.doc.nodes[parentId].name).toBe('')
    expect(state.doc.nodes[parentId].childrenIds).toEqual([childId])
    expect(state.isEditing).toBe(true)
  })

  it('supports undo and redo across editing operations', () => {
    const store = createTreeStore()
    const rootId = getState(store).doc.rootId

    store.insertBelow()
    let state = getState(store)
    expect(state.doc.nodes[rootId].childrenIds.length).toBe(1)

    store.undo()
    state = getState(store)
    expect(state.doc.nodes[rootId].childrenIds.length).toBe(0)

    store.redo()
    state = getState(store)
    expect(state.doc.nodes[rootId].childrenIds.length).toBe(1)
  })

  it('exports ASCII tree and persists state after edits', () => {
    const store = createTreeStore()

    store.insertBelow()
    const firstId = getState(store).cursorId
    store.setEditBuffer('')
    store.confirmEdit()

    const ascii = store.exportAscii()
    expect(ascii).toBe(`main\n└── (empty)`)

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()

    const restored = createTreeStore()
    const restoredState = getState(restored)
    expect(getRootNode(restoredState).childrenIds).toEqual([firstId])
  })
})
