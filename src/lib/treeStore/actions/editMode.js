import { MODE_COMMENT, MODE_FOCUS, MODE_NAME } from '../constants'

export function sanitizeName(name) {
  if (typeof name !== 'string') {
    return ''
  }
  return name.replace(/ /g, '')
}

export function sanitizeComment(comment) {
  if (typeof comment !== 'string') {
    return ''
  }
  return comment
}

export function emptyBuffers() {
  return {
    nameBuffer: '',
    nameOriginal: '',
    commentBuffer: '',
    commentOriginal: '',
  }
}

export function normalizeCursorId(doc, cursorId) {
  if (doc.nodes[cursorId]) {
    return cursorId
  }
  return doc.rootId
}

export function focusFields(cursorId) {
  return {
    cursorId,
    mode: MODE_FOCUS,
    ...emptyBuffers(),
  }
}

export function nameFieldsFromDoc(doc, cursorId) {
  const node = doc.nodes[cursorId]
  const name = node ? sanitizeName(node.name) : ''
  return {
    cursorId,
    mode: MODE_NAME,
    nameBuffer: name,
    nameOriginal: name,
    commentBuffer: '',
    commentOriginal: '',
  }
}

export function commentFieldsFromDoc(doc, cursorId) {
  const node = doc.nodes[cursorId]
  const comment = node ? sanitizeComment(node.comment) : ''
  return {
    cursorId,
    mode: MODE_COMMENT,
    nameBuffer: '',
    nameOriginal: '',
    commentBuffer: comment,
    commentOriginal: comment,
  }
}

export function preserveModeFields(state, cursorId = state.cursorId) {
  if (state.mode === MODE_NAME) {
    return {
      cursorId,
      mode: MODE_NAME,
      nameBuffer: state.nameBuffer,
      nameOriginal: state.nameOriginal,
      commentBuffer: '',
      commentOriginal: '',
    }
  }

  if (state.mode === MODE_COMMENT) {
    return {
      cursorId,
      mode: MODE_COMMENT,
      nameBuffer: '',
      nameOriginal: '',
      commentBuffer: state.commentBuffer,
      commentOriginal: state.commentOriginal,
    }
  }

  return focusFields(cursorId)
}

export function createEditModeActions({ withDocChange, removeNodeAndPromoteChildren }) {
  function confirmNameEditState(state) {
    if (state.mode !== MODE_NAME) {
      return state
    }

    const node = state.doc.nodes[state.cursorId]
    if (!node) {
      return {
        ...state,
        ...focusFields(state.cursorId),
      }
    }

    const nextName = sanitizeName(state.nameBuffer)

    if (nextName === '') {
      if (node.id === state.doc.rootId) {
        return {
          ...state,
          ...focusFields(state.cursorId),
        }
      }

      return withDocChange(state, (doc) => {
        const result = removeNodeAndPromoteChildren(doc, state.cursorId)
        if (!result.changed) {
          return { changed: false }
        }

        return {
          changed: true,
          ...focusFields(result.cursorId ?? doc.rootId),
        }
      })
    }

    if (node.name === nextName) {
      return {
        ...state,
        ...focusFields(state.cursorId),
      }
    }

    return withDocChange(state, (doc) => {
      const nextNode = doc.nodes[state.cursorId]
      if (!nextNode) {
        return { changed: false }
      }

      nextNode.name = nextName
      return {
        changed: true,
        ...focusFields(nextNode.id),
      }
    })
  }

  function confirmCommentEditState(state, nextMode = MODE_FOCUS, nextCursorId = state.cursorId) {
    if (state.mode !== MODE_COMMENT) {
      return state
    }

    const safeCursorId = state.doc.nodes[nextCursorId] ? nextCursorId : state.cursorId
    const node = state.doc.nodes[state.cursorId]
    if (!node) {
      return {
        ...state,
        ...focusFields(safeCursorId),
      }
    }

    const nextComment = sanitizeComment(state.commentBuffer)
    if (sanitizeComment(node.comment) === nextComment) {
      if (nextMode === MODE_COMMENT) {
        return {
          ...state,
          ...commentFieldsFromDoc(state.doc, safeCursorId),
        }
      }

      return {
        ...state,
        ...focusFields(safeCursorId),
      }
    }

    return withDocChange(state, (doc) => {
      const currentNode = doc.nodes[state.cursorId]
      if (!currentNode) {
        return { changed: false }
      }

      currentNode.comment = nextComment
      const targetCursorId = doc.nodes[safeCursorId] ? safeCursorId : currentNode.id

      if (nextMode === MODE_COMMENT) {
        const target = commentFieldsFromDoc(doc, targetCursorId)
        return {
          changed: true,
          mode: MODE_COMMENT,
          cursorId: target.cursorId,
          nameBuffer: '',
          nameOriginal: '',
          commentBuffer: target.commentBuffer,
          commentOriginal: target.commentOriginal,
        }
      }

      return {
        changed: true,
        ...focusFields(targetCursorId),
      }
    })
  }

  return {
    confirmNameEditState,
    confirmCommentEditState,
  }
}
