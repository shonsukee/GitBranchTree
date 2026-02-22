import {
  isCommentToInputShortcut,
  isMoveBranchDownShortcut,
  isMoveBranchUpShortcut,
  isMoveDownKey,
  isMoveUpKey,
  isPlainFocusShortcut,
  isRedoShortcut,
  isUndoShortcut,
} from './keyMap'

export function createGlobalKeydownHandler({
  getState,
  isExportOpen,
  closeExportModal,
  isHelpOpen,
  closeHelpModal,
  openHelpModal,
  resetGSequence,
  armGSequence,
  isGSequenceArmed,
  treeStore,
}) {
  return function handleGlobalKeydown(event) {
    const state = getState()
    const key = event.key
    const code = event.code
    const moveUpKey = isMoveUpKey(key, code)
    const moveDownKey = isMoveDownKey(key, code)
    const isKeyI = code === 'KeyI' || key === 'i' || key === 'I'
    const isKeyC = code === 'KeyC' || key === 'c' || key === 'C'
    const isKeyG = code === 'KeyG' || key === 'g' || key === 'G'
    const isUpperG = key === 'G' || (code === 'KeyG' && event.shiftKey)

    if (isExportOpen()) {
      if (key === 'Escape') {
        event.preventDefault()
        closeExportModal()
      }
      return
    }

    if (isHelpOpen()) {
      if (key === 'Escape') {
        event.preventDefault()
        closeHelpModal()
      }
      return
    }

    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    if (isUndoShortcut(event)) {
      event.preventDefault()
      resetGSequence()
      treeStore.undo()
      return
    }

    if (isRedoShortcut(event)) {
      event.preventDefault()
      resetGSequence()
      treeStore.redo()
      return
    }

    if (state.mode === 'comment') {
      resetGSequence()

      if (isCommentToInputShortcut(event)) {
        event.preventDefault()
        treeStore.confirmCommentEdit()
        treeStore.startEdit()
        return
      }

      if (key === 'ArrowUp') {
        event.preventDefault()
        treeStore.moveUp()
        return
      }

      if (key === 'ArrowDown') {
        event.preventDefault()
        treeStore.moveDown()
        return
      }

      if (key === 'Escape') {
        event.preventDefault()
        treeStore.confirmCommentEdit()
        return
      }

      if (key === 'Enter') {
        event.preventDefault()
        treeStore.confirmCommentEdit()
        return
      }

      if (key === 'Tab') {
        event.preventDefault()
      }
      return
    }

    if (state.mode === 'focus' && isMoveBranchUpShortcut(event)) {
      event.preventDefault()
      resetGSequence()
      treeStore.moveBranchUp()
      return
    }

    if (state.mode === 'focus' && isMoveBranchDownShortcut(event)) {
      event.preventDefault()
      resetGSequence()
      treeStore.moveBranchDown()
      return
    }

    if (state.mode === 'focus' && isPlainFocusShortcut(event)) {
      if (key === '?') {
        event.preventDefault()
        resetGSequence()
        openHelpModal()
        return
      }

      if (isKeyG && !isUpperG) {
        event.preventDefault()
        if (isGSequenceArmed()) {
          resetGSequence()
          treeStore.moveTop()
        } else {
          armGSequence()
        }
        return
      }

      if (isUpperG) {
        event.preventDefault()
        resetGSequence()
        treeStore.moveBottom()
        return
      }
    }

    resetGSequence()

    if (isKeyI) {
      if (state.mode === 'focus' && isPlainFocusShortcut(event)) {
        event.preventDefault()
        treeStore.startEdit()
      }
      return
    }

    if (isKeyC) {
      if (state.mode === 'focus' && isPlainFocusShortcut(event)) {
        event.preventDefault()
        treeStore.startCommentEdit()
      }
      return
    }

    if (key === 'Escape') {
      if (state.mode === 'name') {
        event.preventDefault()
        treeStore.confirmEdit()
      }
      return
    }

    if (moveUpKey) {
      if (state.mode !== 'focus') {
        return
      }
      event.preventDefault()
      treeStore.moveUp()
      return
    }

    if (moveDownKey) {
      if (state.mode !== 'focus') {
        return
      }
      event.preventDefault()
      treeStore.moveDown()
      return
    }

    if (key === 'Enter') {
      if (state.mode !== 'focus') {
        return
      }
      event.preventDefault()
      treeStore.insertChildTop()
      return
    }

    if (key === 'Tab') {
      if (state.mode !== 'focus') {
        return
      }
      event.preventDefault()
      if (event.shiftKey) {
        treeStore.outdentLeft()
      } else {
        treeStore.indentRight()
      }
      return
    }

    if (key === 'Delete' || key === 'Backspace') {
      if (state.mode !== 'focus') {
        return
      }
      event.preventDefault()
      treeStore.deleteNode()
      return
    }

    if (key === ' ') {
      if (state.mode !== 'focus') {
        return
      }
      event.preventDefault()
      treeStore.indentRight()
    }
  }
}
