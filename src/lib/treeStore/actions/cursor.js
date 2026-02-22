export function createCursorActions({ computeVisibleList, focusFields, commentFieldsFromDoc, nameFieldsFromDoc }) {
  function moveCursorByOffset(state, offset, preserveMode = false) {
    const visibleList = computeVisibleList(state.doc)
    const currentIndex = visibleList.indexOf(state.cursorId)

    if (currentIndex === -1) {
      return state
    }

    const targetIndex = currentIndex + offset
    if (targetIndex < 0 || targetIndex >= visibleList.length) {
      return state
    }

    const cursorId = visibleList[targetIndex]
    if (!preserveMode) {
      return {
        ...state,
        ...focusFields(cursorId),
      }
    }

    if (state.mode === 'comment') {
      return {
        ...state,
        ...commentFieldsFromDoc(state.doc, cursorId),
      }
    }

    if (state.mode === 'name') {
      return {
        ...state,
        ...nameFieldsFromDoc(state.doc, cursorId),
      }
    }

    return {
      ...state,
      ...focusFields(cursorId),
    }
  }

  function moveCursorToBoundary(state, toLast = false) {
    const visibleList = computeVisibleList(state.doc)
    if (visibleList.length === 0) {
      return state
    }

    const cursorId = toLast ? visibleList[visibleList.length - 1] : visibleList[0]
    return {
      ...state,
      ...focusFields(cursorId),
    }
  }

  return {
    moveCursorByOffset,
    moveCursorToBoundary,
  }
}
