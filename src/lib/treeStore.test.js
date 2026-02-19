import { get } from 'svelte/store'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY, createTreeStore } from './treeStore'
import { computeVisibleList } from './treeUtils'

function getState(store) {
  return get(store)
}

function getRootNode(state) {
  return state.doc.nodes[state.doc.rootId]
}

function assertNoEmptyNonRootNodes(state) {
  for (const node of Object.values(state.doc.nodes)) {
    if (node.id === state.doc.rootId) {
      continue
    }
    expect(node.name).not.toBe('')
  }
}

function createMemoryStorage() {
  const memory = new Map()

  return {
    getItem(key) {
      return memory.has(key) ? memory.get(key) : null
    },
    setItem(key, value) {
      memory.set(key, String(value))
    },
    removeItem(key) {
      memory.delete(key)
    },
    clear() {
      memory.clear()
    },
  }
}

describe('treeStore', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createMemoryStorage(),
      configurable: true,
      writable: true,
    })
  })

  it('starts with a single main root node', () => {
    const store = createTreeStore()
    const state = getState(store)
    const root = getRootNode(state)

    expect(root.name).toBe('main')
    expect(root.parentId).toBe(null)
    expect(state.cursorId).toBe(state.doc.rootId)
  })

  it('restores document from localStorage and migrates legacy empty nodes', () => {
    const saved = {
      rootId: 'root',
      nodes: {
        root: {
          id: 'root',
          name: 'main',
          parentId: null,
          childrenIds: ['legacy-empty'],
        },
        'legacy-empty': {
          id: 'legacy-empty',
          name: '',
          parentId: 'root',
          childrenIds: ['develop'],
        },
        develop: {
          id: 'develop',
          name: 'develop',
          parentId: 'legacy-empty',
          childrenIds: [],
        },
      },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))

    const store = createTreeStore()
    const state = getState(store)

    expect(state.doc.nodes['legacy-empty']).toBeUndefined()
    expect(state.doc.nodes.root.childrenIds).toEqual(['develop'])
    expect(state.doc.nodes.develop.parentId).toBe('root')
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

  it('deletes selected node and promotes children while keeping order', () => {
    const store = createTreeStore()

    store.insertBelow()
    const developId = getState(store).cursorId
    store.setEditBuffer('develop')
    store.confirmEdit()

    store.insertBelow()
    const releaseId = getState(store).cursorId
    store.setEditBuffer('release')
    store.confirmEdit()

    store.selectCursor(releaseId)
    store.insertBelow()
    const hotfixId = getState(store).cursorId
    store.setEditBuffer('hotfix')
    store.confirmEdit()
    store.indentRight()

    store.selectCursor(releaseId)
    store.deleteNode()

    const state = getState(store)
    const root = getRootNode(state)

    expect(state.doc.nodes[releaseId]).toBeUndefined()
    expect(root.childrenIds).toEqual([developId, hotfixId])
    expect(state.doc.nodes[hotfixId].parentId).toBe(root.id)
  })

  it('does not delete root node', () => {
    const store = createTreeStore()
    const rootId = getState(store).doc.rootId

    store.deleteNode()
    const state = getState(store)
    expect(state.doc.nodes[rootId]).toBeDefined()
    expect(computeVisibleList(state.doc)).toEqual([rootId])
  })

  it('auto-removes empty node on edit confirm', () => {
    const store = createTreeStore()
    const rootId = getState(store).doc.rootId

    store.insertBelow()
    const createdNodeId = getState(store).cursorId
    store.setEditBuffer('')
    store.confirmEdit()

    const state = getState(store)
    expect(state.doc.nodes[createdNodeId]).toBeUndefined()
    expect(state.doc.nodes[rootId].childrenIds).toEqual([])
  })

  it('moves branch up and down with preorder shortcuts', () => {
    const store = createTreeStore()

    store.insertBelow()
    const developId = getState(store).cursorId
    store.setEditBuffer('develop')
    store.confirmEdit()

    store.insertBelow()
    const releaseId = getState(store).cursorId
    store.setEditBuffer('release')
    store.confirmEdit()

    store.insertBelow()
    const hotfixId = getState(store).cursorId
    store.setEditBuffer('hotfix')
    store.confirmEdit()

    store.selectCursor(hotfixId)
    store.moveBranchUp()

    let state = getState(store)
    let root = getRootNode(state)
    expect(root.childrenIds).toEqual([developId, hotfixId, releaseId])

    store.moveBranchDown()
    state = getState(store)
    root = getRootNode(state)
    expect(root.childrenIds).toEqual([developId, releaseId, hotfixId])
  })

  it('moves cursor to top and bottom nodes', () => {
    const store = createTreeStore()

    store.insertBelow()
    store.setEditBuffer('develop')
    store.confirmEdit()

    store.insertBelow()
    const releaseId = getState(store).cursorId
    store.setEditBuffer('release')
    store.confirmEdit()

    store.moveTop()
    let state = getState(store)
    expect(state.cursorId).toBe(state.doc.rootId)

    store.moveBottom()
    state = getState(store)
    expect(state.cursorId).toBe(releaseId)
  })

  it('moves down through child and grandchild order instead of skipping subtree', () => {
    const store = createTreeStore()

    store.insertBelow()
    const parentId = getState(store).cursorId
    store.setEditBuffer('parent')
    store.confirmEdit()

    store.insertBelow()
    const childId = getState(store).cursorId
    store.setEditBuffer('child')
    store.confirmEdit()
    store.indentRight()

    store.insertBelow()
    const grandChildId = getState(store).cursorId
    store.setEditBuffer('grand-child')
    store.confirmEdit()
    store.indentRight()

    store.selectCursor(parentId)
    store.moveBranchDown()
    let visible = computeVisibleList(getState(store).doc)
    expect(visible.slice(1, 4)).toEqual([childId, parentId, grandChildId])

    store.moveBranchDown()
    visible = computeVisibleList(getState(store).doc)
    expect(visible.slice(1, 4)).toEqual([childId, grandChildId, parentId])
  })

  it('supports undo and redo across delete and move operations', () => {
    const store = createTreeStore()

    store.insertBelow()
    const branchId = getState(store).cursorId
    store.setEditBuffer('develop')
    store.confirmEdit()

    store.deleteNode()
    let state = getState(store)
    expect(state.doc.nodes[branchId]).toBeUndefined()

    store.undo()
    state = getState(store)
    expect(state.doc.nodes[branchId]).toBeDefined()

    store.redo()
    state = getState(store)
    expect(state.doc.nodes[branchId]).toBeUndefined()
  })

  it('does not leave empty nodes after repeated undo and redo', () => {
    const store = createTreeStore()

    store.insertBelow()
    store.setEditBuffer('develop')
    store.confirmEdit()

    for (let i = 0; i < 5; i += 1) {
      store.undo()
      let state = getState(store)
      assertNoEmptyNonRootNodes(state)

      store.redo()
      state = getState(store)
      assertNoEmptyNonRootNodes(state)
    }
  })

  it('exports ASCII tree and persists state after edits', () => {
    const store = createTreeStore()
    const rootId = getState(store).doc.rootId

    store.insertBelow()
    const developId = getState(store).cursorId
    store.setEditBuffer('develop')
    store.confirmEdit()

    const ascii = store.exportAscii()
    expect(ascii).toBe(`main\n└── develop`)

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()

    const restored = createTreeStore()
    const restoredState = getState(restored)
    expect(restoredState.doc.nodes[rootId].childrenIds).toEqual([developId])
  })
})
