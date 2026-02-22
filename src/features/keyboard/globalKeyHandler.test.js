import { describe, expect, it, vi } from 'vitest'
import { createGlobalKeydownHandler } from './globalKeyHandler'
import { shouldActivateRowFromKeydown } from './rowInteraction'

function createKeyEvent({ key, code = '', shiftKey = false, ctrlKey = false, metaKey = false, altKey = false }) {
  return {
    key,
    code,
    shiftKey,
    ctrlKey,
    metaKey,
    altKey,
    target: {},
    preventDefault: vi.fn(),
  }
}

function createStoreSpies() {
  return {
    undo: vi.fn(),
    redo: vi.fn(),
    moveBranchUp: vi.fn(),
    moveBranchDown: vi.fn(),
    moveTop: vi.fn(),
    moveBottom: vi.fn(),
    startEdit: vi.fn(),
    startCommentEdit: vi.fn(),
    confirmEdit: vi.fn(),
    moveUp: vi.fn(),
    moveDown: vi.fn(),
    insertChildTop: vi.fn(),
    outdentLeft: vi.fn(),
    indentRight: vi.fn(),
    deleteNode: vi.fn(),
    confirmCommentEdit: vi.fn(),
  }
}

describe('rowInteraction', () => {
  it('activates row only for Enter/Space from row itself', () => {
    expect(shouldActivateRowFromKeydown('Enter', true)).toBe(true)
    expect(shouldActivateRowFromKeydown(' ', true)).toBe(true)
    expect(shouldActivateRowFromKeydown('Enter', false)).toBe(false)
    expect(shouldActivateRowFromKeydown('x', true)).toBe(false)
  })
})

describe('globalKeyHandler', () => {
  it('inserts first child on Enter in focus mode', () => {
    let state = { mode: 'focus', cursorId: 'x' }
    const store = createStoreSpies()

    const handler = createGlobalKeydownHandler({
      getState: () => state,
      isExportOpen: () => false,
      closeExportModal: vi.fn(),
      isHelpOpen: () => false,
      closeHelpModal: vi.fn(),
      openHelpModal: vi.fn(),
      resetGSequence: vi.fn(),
      armGSequence: vi.fn(),
      isGSequenceArmed: () => false,
      treeStore: store,
    })

    const event = createKeyEvent({ key: 'Enter' })
    handler(event)

    expect(store.insertChildTop).toHaveBeenCalledTimes(1)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(store.insertBelow).toBeUndefined()
  })

  it('does not move in comment mode when pressing h', () => {
    const store = createStoreSpies()

    const handler = createGlobalKeydownHandler({
      getState: () => ({ mode: 'comment', cursorId: 'x' }),
      isExportOpen: () => false,
      closeExportModal: vi.fn(),
      isHelpOpen: () => false,
      closeHelpModal: vi.fn(),
      openHelpModal: vi.fn(),
      resetGSequence: vi.fn(),
      armGSequence: vi.fn(),
      isGSequenceArmed: () => false,
      treeStore: store,
    })

    const event = createKeyEvent({ key: 'h', code: 'KeyH' })
    handler(event)

    expect(store.moveUp).not.toHaveBeenCalled()
    expect(store.moveDown).not.toHaveBeenCalled()
    expect(store.confirmCommentEdit).not.toHaveBeenCalled()
  })

  it('moves in comment mode when pressing ArrowUp/ArrowDown', () => {
    const store = createStoreSpies()
    const handler = createGlobalKeydownHandler({
      getState: () => ({ mode: 'comment', cursorId: 'x' }),
      isExportOpen: () => false,
      closeExportModal: vi.fn(),
      isHelpOpen: () => false,
      closeHelpModal: vi.fn(),
      openHelpModal: vi.fn(),
      resetGSequence: vi.fn(),
      armGSequence: vi.fn(),
      isGSequenceArmed: () => false,
      treeStore: store,
    })

    const upEvent = createKeyEvent({ key: 'ArrowUp' })
    handler(upEvent)
    expect(upEvent.preventDefault).toHaveBeenCalledTimes(1)
    expect(store.moveUp).toHaveBeenCalledTimes(1)

    const downEvent = createKeyEvent({ key: 'ArrowDown' })
    handler(downEvent)
    expect(downEvent.preventDefault).toHaveBeenCalledTimes(1)
    expect(store.moveDown).toHaveBeenCalledTimes(1)
  })

  it('moves from comment to input on Ctrl/Cmd+I and persists comment first', () => {
    const store = createStoreSpies()
    const handler = createGlobalKeydownHandler({
      getState: () => ({ mode: 'comment', cursorId: 'x' }),
      isExportOpen: () => false,
      closeExportModal: vi.fn(),
      isHelpOpen: () => false,
      closeHelpModal: vi.fn(),
      openHelpModal: vi.fn(),
      resetGSequence: vi.fn(),
      armGSequence: vi.fn(),
      isGSequenceArmed: () => false,
      treeStore: store,
    })

    const event = createKeyEvent({ key: 'i', code: 'KeyI', ctrlKey: true })
    handler(event)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(store.confirmCommentEdit).toHaveBeenCalledTimes(1)
    expect(store.startEdit).toHaveBeenCalledTimes(1)
  })

  it('does not treat plain i as shortcut while in comment mode', () => {
    const store = createStoreSpies()
    const handler = createGlobalKeydownHandler({
      getState: () => ({ mode: 'comment', cursorId: 'x' }),
      isExportOpen: () => false,
      closeExportModal: vi.fn(),
      isHelpOpen: () => false,
      closeHelpModal: vi.fn(),
      openHelpModal: vi.fn(),
      resetGSequence: vi.fn(),
      armGSequence: vi.fn(),
      isGSequenceArmed: () => false,
      treeStore: store,
    })

    const event = createKeyEvent({ key: 'i', code: 'KeyI' })
    handler(event)

    expect(store.confirmCommentEdit).not.toHaveBeenCalled()
    expect(store.startEdit).not.toHaveBeenCalled()
  })

  it('closes export modal on Escape before handling shortcuts', () => {
    const closeExportModal = vi.fn()
    const store = createStoreSpies()

    const handler = createGlobalKeydownHandler({
      getState: () => ({ mode: 'focus', cursorId: 'x' }),
      isExportOpen: () => true,
      closeExportModal,
      isHelpOpen: () => false,
      closeHelpModal: vi.fn(),
      openHelpModal: vi.fn(),
      resetGSequence: vi.fn(),
      armGSequence: vi.fn(),
      isGSequenceArmed: () => false,
      treeStore: store,
    })

    const event = createKeyEvent({ key: 'Escape' })
    handler(event)

    expect(closeExportModal).toHaveBeenCalledTimes(1)
    expect(store.undo).not.toHaveBeenCalled()
  })
})
