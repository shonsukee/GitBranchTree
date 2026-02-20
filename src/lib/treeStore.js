import { get, writable } from 'svelte/store'
import {
  cloneDocument,
  computeVisibleList,
  createInitialDocument,
  generateNodeId,
  migrateLegacyEmptyNodes,
  normalizeDocument,
  serializeAsciiTree,
} from './treeUtils'

export const STORAGE_KEY = 'gitbranchtree.document.v1'
export const HISTORY_LIMIT = 100

const MODE_FOCUS = 'focus'
const MODE_NAME = 'name'
const MODE_COMMENT = 'comment'

function hasLocalStorage() {
  return (
    typeof localStorage !== 'undefined' &&
    localStorage !== null &&
    typeof localStorage.getItem === 'function' &&
    typeof localStorage.setItem === 'function'
  )
}

function sanitizeName(name) {
  if (typeof name !== 'string') {
    return ''
  }
  return name.replace(/ /g, '')
}

function sanitizeComment(comment) {
  if (typeof comment !== 'string') {
    return ''
  }
  return comment
}

function emptyBuffers() {
  return {
    nameBuffer: '',
    nameOriginal: '',
    commentBuffer: '',
    commentOriginal: '',
  }
}

function normalizeCursorId(doc, cursorId) {
  if (doc.nodes[cursorId]) {
    return cursorId
  }
  return doc.rootId
}

function focusFields(cursorId) {
  return {
    cursorId,
    mode: MODE_FOCUS,
    ...emptyBuffers(),
  }
}

function nameFieldsFromDoc(doc, cursorId) {
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

function commentFieldsFromDoc(doc, cursorId) {
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

function preserveModeFields(state, cursorId = state.cursorId) {
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

function loadDocumentFromStorage() {
  if (!hasLocalStorage()) {
    return null
  }

  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)
    const normalized = normalizeDocument(parsed)
    return migrateLegacyEmptyNodes(normalized)
  } catch (error) {
    console.error('Failed to restore GitBranchTree document from localStorage', error)
    return null
  }
}

function saveDocumentToStorage(doc) {
  if (!hasLocalStorage()) {
    return
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc))
  } catch (error) {
    console.error('Failed to save GitBranchTree document to localStorage', error)
  }
}

function appendHistory(history, docSnapshot) {
  if (history.length < HISTORY_LIMIT) {
    return [...history, docSnapshot]
  }
  return [...history.slice(1), docSnapshot]
}

function buildInitialState(doc) {
  return {
    doc,
    ...focusFields(doc.rootId),
    historyPast: [],
    historyFuture: [],
  }
}

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

  if (state.mode === MODE_COMMENT) {
    return {
      ...state,
      ...commentFieldsFromDoc(state.doc, cursorId),
    }
  }

  if (state.mode === MODE_NAME) {
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

function withDocChange(state, mutator) {
  const nextDoc = cloneDocument(state.doc)
  const result = mutator(nextDoc, state) ?? { changed: false }

  if (!result.changed) {
    return state
  }

  const cursorId = normalizeCursorId(nextDoc, result.cursorId ?? state.cursorId)
  const mode = result.mode ?? MODE_FOCUS

  let editorFields = {
    mode,
    nameBuffer: result.nameBuffer ?? '',
    nameOriginal: result.nameOriginal ?? '',
    commentBuffer: result.commentBuffer ?? '',
    commentOriginal: result.commentOriginal ?? '',
  }

  if (mode === MODE_COMMENT && result.commentBuffer === undefined) {
    const derived = commentFieldsFromDoc(nextDoc, cursorId)
    editorFields = {
      ...editorFields,
      commentBuffer: derived.commentBuffer,
      commentOriginal: derived.commentOriginal,
      nameBuffer: '',
      nameOriginal: '',
    }
  }

  if (mode === MODE_NAME && result.nameBuffer === undefined) {
    const derived = nameFieldsFromDoc(nextDoc, cursorId)
    editorFields = {
      ...editorFields,
      nameBuffer: derived.nameBuffer,
      nameOriginal: derived.nameOriginal,
      commentBuffer: '',
      commentOriginal: '',
    }
  }

  if (mode === MODE_FOCUS) {
    editorFields = {
      mode: MODE_FOCUS,
      ...emptyBuffers(),
    }
  }

  const historyPast = appendHistory(state.historyPast, cloneDocument(state.doc))
  const nextState = {
    ...state,
    doc: nextDoc,
    cursorId,
    ...editorFields,
    historyPast,
    historyFuture: [],
  }

  saveDocumentToStorage(nextDoc)
  return nextState
}

function insertBelowState(state) {
  return withDocChange(state, (doc) => {
    const cursorNode = doc.nodes[state.cursorId]
    if (!cursorNode) {
      return { changed: false }
    }

    const nodeId = generateNodeId()
    doc.nodes[nodeId] = {
      id: nodeId,
      name: '',
      comment: '',
      parentId: null,
      childrenIds: [],
    }

    if (cursorNode.id === doc.rootId) {
      cursorNode.childrenIds.push(nodeId)
      doc.nodes[nodeId].parentId = cursorNode.id
    } else {
      const parent = doc.nodes[cursorNode.parentId]
      if (!parent) {
        return { changed: false }
      }

      const currentIndex = parent.childrenIds.indexOf(cursorNode.id)
      const insertIndex = currentIndex === -1 ? parent.childrenIds.length : currentIndex + 1
      parent.childrenIds.splice(insertIndex, 0, nodeId)
      doc.nodes[nodeId].parentId = parent.id
    }

    return {
      changed: true,
      cursorId: nodeId,
      mode: MODE_NAME,
      nameBuffer: '',
      nameOriginal: '',
      commentBuffer: '',
      commentOriginal: '',
    }
  })
}

function insertChildTopState(state) {
  return withDocChange(state, (doc) => {
    const cursorNode = doc.nodes[state.cursorId]
    if (!cursorNode) {
      return { changed: false }
    }

    const nodeId = generateNodeId()
    doc.nodes[nodeId] = {
      id: nodeId,
      name: '',
      comment: '',
      parentId: cursorNode.id,
      childrenIds: [],
    }
    cursorNode.childrenIds.unshift(nodeId)

    return {
      changed: true,
      cursorId: nodeId,
      mode: MODE_NAME,
      nameBuffer: '',
      nameOriginal: '',
      commentBuffer: '',
      commentOriginal: '',
    }
  })
}

function indentRightState(state) {
  return withDocChange(state, (doc) => {
    const node = doc.nodes[state.cursorId]
    if (!node || node.parentId === null) {
      return { changed: false }
    }

    const parent = doc.nodes[node.parentId]
    if (!parent) {
      return { changed: false }
    }

    const index = parent.childrenIds.indexOf(node.id)
    if (index <= 0) {
      return { changed: false }
    }

    const newParentId = parent.childrenIds[index - 1]
    const newParent = doc.nodes[newParentId]
    if (!newParent) {
      return { changed: false }
    }

    parent.childrenIds.splice(index, 1)
    node.parentId = newParentId
    newParent.childrenIds.push(node.id)

    return {
      changed: true,
      ...preserveModeFields(state, node.id),
    }
  })
}

function outdentLeftState(state) {
  const node = state.doc.nodes[state.cursorId]
  if (!node) {
    return state
  }

  if (node.parentId === null) {
    return moveCursorByOffset(state, -1, true)
  }

  if (node.parentId === state.doc.rootId) {
    return moveCursorByOffset(state, -1, true)
  }

  return withDocChange(state, (doc) => {
    const current = doc.nodes[state.cursorId]
    if (!current || current.parentId === null) {
      return { changed: false }
    }

    const parent = doc.nodes[current.parentId]
    if (!parent) {
      return { changed: false }
    }

    const currentIndex = parent.childrenIds.indexOf(current.id)
    if (currentIndex === -1) {
      return { changed: false }
    }

    parent.childrenIds.splice(currentIndex, 1)

    const grandParent = doc.nodes[parent.parentId]
    if (!grandParent) {
      return { changed: false }
    }

    const parentIndex = grandParent.childrenIds.indexOf(parent.id)
    const insertIndex = parentIndex === -1 ? grandParent.childrenIds.length : parentIndex + 1

    current.parentId = grandParent.id
    grandParent.childrenIds.splice(insertIndex, 0, current.id)

    return {
      changed: true,
      ...preserveModeFields(state, current.id),
    }
  })
}

function isDescendant(doc, nodeId, ancestorId) {
  let currentId = nodeId
  const visited = new Set()

  while (currentId) {
    if (currentId === ancestorId) {
      return true
    }
    if (visited.has(currentId)) {
      return false
    }
    visited.add(currentId)
    currentId = doc.nodes[currentId]?.parentId ?? null
  }

  return false
}

function removeNodeAndPromoteChildren(doc, nodeId) {
  const node = doc.nodes[nodeId]
  if (!node || node.parentId === null) {
    return { changed: false, cursorId: null }
  }

  const parent = doc.nodes[node.parentId]
  if (!parent) {
    return { changed: false, cursorId: null }
  }

  const index = parent.childrenIds.indexOf(node.id)
  if (index === -1) {
    return { changed: false, cursorId: null }
  }

  const promotedChildren = node.childrenIds.filter((childId) => doc.nodes[childId])
  parent.childrenIds.splice(index, 1, ...promotedChildren)

  for (const childId of promotedChildren) {
    doc.nodes[childId].parentId = parent.id
  }

  delete doc.nodes[node.id]

  let cursorId = parent.id
  if (promotedChildren.length > 0) {
    cursorId = promotedChildren[0]
  } else if (parent.childrenIds[index]) {
    cursorId = parent.childrenIds[index]
  } else if (index > 0 && parent.childrenIds[index - 1]) {
    cursorId = parent.childrenIds[index - 1]
  }

  return { changed: true, cursorId }
}

function deleteNodeState(state) {
  const currentNode = state.doc.nodes[state.cursorId]
  if (!currentNode || currentNode.id === state.doc.rootId) {
    return state
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

function moveNodeBefore(doc, nodeId, beforeNodeId) {
  const node = doc.nodes[nodeId]
  const beforeNode = doc.nodes[beforeNodeId]

  if (!node || !beforeNode || node.parentId === null || beforeNode.parentId === null) {
    return false
  }

  const sourceParent = doc.nodes[node.parentId]
  const targetParent = doc.nodes[beforeNode.parentId]
  if (!sourceParent || !targetParent) {
    return false
  }

  if (isDescendant(doc, targetParent.id, node.id)) {
    return false
  }

  const sourceIndex = sourceParent.childrenIds.indexOf(node.id)
  let targetIndex = targetParent.childrenIds.indexOf(beforeNode.id)
  if (sourceIndex === -1 || targetIndex === -1) {
    return false
  }

  sourceParent.childrenIds.splice(sourceIndex, 1)
  if (sourceParent.id === targetParent.id && sourceIndex < targetIndex) {
    targetIndex -= 1
  }

  targetParent.childrenIds.splice(targetIndex, 0, node.id)
  node.parentId = targetParent.id
  return true
}

function moveNodeAfter(doc, nodeId, afterNodeId) {
  const node = doc.nodes[nodeId]
  const afterNode = doc.nodes[afterNodeId]

  if (!node || !afterNode || node.parentId === null || afterNode.parentId === null) {
    return false
  }

  const sourceParent = doc.nodes[node.parentId]
  const targetParent = doc.nodes[afterNode.parentId]
  if (!sourceParent || !targetParent) {
    return false
  }

  if (isDescendant(doc, targetParent.id, node.id)) {
    return false
  }

  const sourceIndex = sourceParent.childrenIds.indexOf(node.id)
  let targetIndex = targetParent.childrenIds.indexOf(afterNode.id) + 1
  if (sourceIndex === -1 || targetIndex === 0) {
    return false
  }

  sourceParent.childrenIds.splice(sourceIndex, 1)
  if (sourceParent.id === targetParent.id && sourceIndex < targetIndex) {
    targetIndex -= 1
  }

  targetParent.childrenIds.splice(targetIndex, 0, node.id)
  node.parentId = targetParent.id
  return true
}

function detachNodeFromParent(doc, nodeId) {
  const node = doc.nodes[nodeId]
  if (!node || node.parentId === null) {
    return false
  }

  const parent = doc.nodes[node.parentId]
  if (!parent) {
    return false
  }

  const index = parent.childrenIds.indexOf(node.id)
  if (index === -1) {
    return false
  }

  parent.childrenIds.splice(index, 1)
  return true
}

function moveBranchUpState(state) {
  const current = state.doc.nodes[state.cursorId]
  if (!current || current.id === state.doc.rootId) {
    return state
  }

  const visibleList = computeVisibleList(state.doc)
  const startIndex = visibleList.indexOf(current.id)
  if (startIndex <= 0) {
    return state
  }

  const previousRowId = visibleList[startIndex - 1]
  if (!previousRowId || previousRowId === state.doc.rootId) {
    return state
  }

  return withDocChange(state, (doc) => {
    const moved = moveNodeBefore(doc, state.cursorId, previousRowId)
    if (!moved) {
      return { changed: false }
    }

    return {
      changed: true,
      ...preserveModeFields(state, state.cursorId),
    }
  })
}

function moveBranchDownState(state) {
  const current = state.doc.nodes[state.cursorId]
  if (!current || current.id === state.doc.rootId) {
    return state
  }

  const visibleList = computeVisibleList(state.doc)
  const startIndex = visibleList.indexOf(current.id)
  if (startIndex === -1 || startIndex >= visibleList.length - 1) {
    return state
  }

  const nextRowId = visibleList[startIndex + 1]
  if (!nextRowId) {
    return state
  }

  return withDocChange(state, (doc) => {
    const node = doc.nodes[state.cursorId]
    const nextNode = doc.nodes[nextRowId]
    if (!node || !nextNode || node.parentId === null) {
      return { changed: false }
    }

    if (nextNode.parentId === node.id) {
      const parent = doc.nodes[node.parentId]
      if (!parent) {
        return { changed: false }
      }

      const parentIndex = parent.childrenIds.indexOf(node.id)
      const childIndex = node.childrenIds.indexOf(nextNode.id)
      if (parentIndex === -1 || childIndex !== 0) {
        return { changed: false }
      }

      parent.childrenIds[parentIndex] = nextNode.id
      node.childrenIds.splice(childIndex, 1)
      nextNode.parentId = parent.id
      nextNode.childrenIds.unshift(node.id)
      node.parentId = nextNode.id
    } else if (nextNode.childrenIds.length > 0) {
      if (!detachNodeFromParent(doc, node.id)) {
        return { changed: false }
      }

      nextNode.childrenIds.unshift(node.id)
      node.parentId = nextNode.id
    } else {
      const moved = moveNodeAfter(doc, node.id, nextNode.id)
      if (!moved) {
        return { changed: false }
      }
    }

    return {
      changed: true,
      ...preserveModeFields(state, state.cursorId),
    }
  })
}

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

export function createTreeStore() {
  const restoredDoc = loadDocumentFromStorage()
  const initialDoc = restoredDoc ?? createInitialDocument()
  const internalStore = writable(buildInitialState(initialDoc))
  const { subscribe, update, set } = internalStore

  if (!restoredDoc) {
    saveDocumentToStorage(initialDoc)
  }

  return {
    subscribe,

    selectCursor(nodeId) {
      update((state) => {
        if (!state.doc.nodes[nodeId]) {
          return state
        }

        return {
          ...state,
          ...focusFields(nodeId),
        }
      })
    },

    moveUp() {
      update((state) => {
        if (state.mode !== MODE_COMMENT) {
          return moveCursorByOffset(state, -1)
        }

        const visibleList = computeVisibleList(state.doc)
        const currentIndex = visibleList.indexOf(state.cursorId)
        const targetId = currentIndex > 0 ? visibleList[currentIndex - 1] : state.cursorId
        return confirmCommentEditState(state, MODE_COMMENT, targetId)
      })
    },

    moveDown() {
      update((state) => {
        if (state.mode !== MODE_COMMENT) {
          return moveCursorByOffset(state, 1)
        }

        const visibleList = computeVisibleList(state.doc)
        const currentIndex = visibleList.indexOf(state.cursorId)
        const targetId =
          currentIndex !== -1 && currentIndex < visibleList.length - 1 ? visibleList[currentIndex + 1] : state.cursorId
        return confirmCommentEditState(state, MODE_COMMENT, targetId)
      })
    },

    moveTop() {
      update((state) => moveCursorToBoundary(state, false))
    },

    moveBottom() {
      update((state) => moveCursorToBoundary(state, true))
    },

    moveBranchUp() {
      update((state) => moveBranchUpState(state))
    },

    moveBranchDown() {
      update((state) => moveBranchDownState(state))
    },

    insertBelow() {
      update((state) => insertBelowState(state))
    },

    insertChildTop() {
      update((state) => insertChildTopState(state))
    },

    indentRight() {
      update((state) => indentRightState(state))
    },

    outdentLeft() {
      update((state) => outdentLeftState(state))
    },

    clearName() {
      update((state) => deleteNodeState(state))
    },

    deleteNode() {
      update((state) => deleteNodeState(state))
    },

    startEdit() {
      update((state) => {
        const node = state.doc.nodes[state.cursorId]
        if (!node) {
          return state
        }

        return {
          ...state,
          ...nameFieldsFromDoc(state.doc, state.cursorId),
        }
      })
    },

    setEditBuffer(value) {
      update((state) => {
        if (state.mode !== MODE_NAME) {
          return state
        }

        return {
          ...state,
          nameBuffer: sanitizeName(value),
        }
      })
    },

    applyTypedChar(char) {
      update((state) => {
        if (typeof char !== 'string' || char.length === 0) {
          return state
        }

        if (char === ' ') {
          return indentRightState(state)
        }

        const node = state.doc.nodes[state.cursorId]
        if (!node) {
          return state
        }

        if (state.mode !== MODE_NAME) {
          return {
            ...state,
            mode: MODE_NAME,
            nameBuffer: `${sanitizeName(node.name)}${char}`,
            nameOriginal: sanitizeName(node.name),
            commentBuffer: '',
            commentOriginal: '',
          }
        }

        return {
          ...state,
          nameBuffer: `${state.nameBuffer}${char}`,
        }
      })
    },

    confirmEdit() {
      update((state) => confirmNameEditState(state))
    },

    cancelEdit() {
      update((state) => {
        if (state.mode !== MODE_NAME) {
          return state
        }

        return {
          ...state,
          ...focusFields(state.cursorId),
        }
      })
    },

    startCommentEdit() {
      update((state) => {
        const node = state.doc.nodes[state.cursorId]
        if (!node) {
          return state
        }

        return {
          ...state,
          ...commentFieldsFromDoc(state.doc, state.cursorId),
        }
      })
    },

    setCommentBuffer(value) {
      update((state) => {
        if (state.mode !== MODE_COMMENT) {
          return state
        }

        return {
          ...state,
          commentBuffer: sanitizeComment(value),
        }
      })
    },

    confirmCommentEdit(keepMode = false) {
      update((state) => confirmCommentEditState(state, keepMode ? MODE_COMMENT : MODE_FOCUS))
    },

    cancelCommentEdit() {
      update((state) => {
        if (state.mode !== MODE_COMMENT) {
          return state
        }

        return {
          ...state,
          ...focusFields(state.cursorId),
        }
      })
    },

    undo() {
      update((state) => {
        if (state.historyPast.length === 0) {
          return state
        }

        const previousDoc = migrateLegacyEmptyNodes(cloneDocument(state.historyPast[state.historyPast.length - 1]))
        const nextPast = state.historyPast.slice(0, -1)
        const nextFuture = [migrateLegacyEmptyNodes(cloneDocument(state.doc)), ...state.historyFuture].slice(
          0,
          HISTORY_LIMIT,
        )
        const cursorId = previousDoc.nodes[state.cursorId] ? state.cursorId : previousDoc.rootId

        saveDocumentToStorage(previousDoc)

        return {
          ...state,
          doc: previousDoc,
          ...focusFields(cursorId),
          historyPast: nextPast,
          historyFuture: nextFuture,
        }
      })
    },

    redo() {
      update((state) => {
        if (state.historyFuture.length === 0) {
          return state
        }

        const [nextDocRaw, ...restFuture] = state.historyFuture
        const nextDoc = migrateLegacyEmptyNodes(cloneDocument(nextDocRaw))
        const nextPast = appendHistory(state.historyPast, migrateLegacyEmptyNodes(cloneDocument(state.doc)))
        const cursorId = nextDoc.nodes[state.cursorId] ? state.cursorId : nextDoc.rootId

        saveDocumentToStorage(nextDoc)
        return {
          ...state,
          doc: nextDoc,
          ...focusFields(cursorId),
          historyPast: nextPast,
          historyFuture: restFuture,
        }
      })
    },

    exportAscii() {
      const state = get(internalStore)
      return serializeAsciiTree(state.doc)
    },

    loadFromStorage() {
      const doc = loadDocumentFromStorage()
      if (!doc) {
        return false
      }
      set(buildInitialState(doc))
      return true
    },

    saveToStorage() {
      const state = get(internalStore)
      saveDocumentToStorage(state.doc)
    },
  }
}

export const treeStore = createTreeStore()
export { loadDocumentFromStorage as loadFromStorage, saveDocumentToStorage as saveToStorage }
