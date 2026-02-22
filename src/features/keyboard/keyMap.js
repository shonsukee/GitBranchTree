export function isUndoShortcut(event) {
  return (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z'
}

export function isRedoShortcut(event) {
  const isPrimaryRedo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y'
  const isMacRedo = (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'z'
  return isPrimaryRedo || isMacRedo
}

export function isMoveBranchUpShortcut(event) {
  return (event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'ArrowUp'
}

export function isMoveBranchDownShortcut(event) {
  return (event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'ArrowDown'
}

export function isMoveUpKey(key, code) {
  return (
    key === 'ArrowUp' ||
    code === 'KeyK' ||
    code === 'KeyL' ||
    key === 'k' ||
    key === 'K' ||
    key === 'l' ||
    key === 'L'
  )
}

export function isMoveDownKey(key, code) {
  return (
    key === 'ArrowDown' ||
    code === 'KeyH' ||
    code === 'KeyJ' ||
    key === 'h' ||
    key === 'H' ||
    key === 'j' ||
    key === 'J'
  )
}

export function isPlainFocusShortcut(event) {
  return !event.ctrlKey && !event.metaKey && !event.altKey
}

export function isCommentToInputShortcut(event) {
  const hasPrimaryModifier = event.ctrlKey || event.metaKey
  const isKeyI = event.code === 'KeyI' || event.key === 'i' || event.key === 'I'
  return hasPrimaryModifier && !event.shiftKey && !event.altKey && isKeyI
}
