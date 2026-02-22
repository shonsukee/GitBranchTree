export function getEditorInputId(mode, cursorId) {
  if (mode !== 'name' && mode !== 'comment') {
    return null
  }
  return mode === 'comment' ? `node-comment-input-${cursorId}` : `node-name-input-${cursorId}`
}

export function shouldRefocusEditor(prevState, nextState, activeElementId) {
  if (!nextState || (nextState.mode !== 'name' && nextState.mode !== 'comment')) {
    return false
  }

  const nextInputId = getEditorInputId(nextState.mode, nextState.cursorId)
  if (!nextInputId) {
    return false
  }

  const prevMode = prevState?.mode
  const prevCursorId = prevState?.cursorId
  const modeChanged = prevMode !== nextState.mode
  const cursorChanged = prevCursorId !== nextState.cursorId

  if (modeChanged || cursorChanged) {
    return true
  }

  return activeElementId !== nextInputId
}
