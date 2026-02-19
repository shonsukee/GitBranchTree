import { get, writable } from 'svelte/store'
import {
  cloneDocument,
  computeVisibleList,
  createInitialDocument,
  generateNodeId,
  getSubtreeIds,
  migrateLegacyEmptyNodes,
  normalizeDocument,
  serializeAsciiTree,
} from './treeUtils'

export const STORAGE_KEY = 'gitbranchtree.document.v1'
export const HISTORY_LIMIT = 100

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
    cursorId: doc.rootId,
    isEditing: false,
    editBuffer: '',
    editOriginal: '',
    historyPast: [],
    historyFuture: [],
  }
}

function moveCursorByOffset(state, offset, preserveEditing = false) {
  const visibleList = computeVisibleList(state.doc)
  const currentIndex = visibleList.indexOf(state.cursorId)

  if (currentIndex === -1) {
    return state
  }

  const targetIndex = currentIndex + offset
  if (targetIndex < 0 || targetIndex >= visibleList.length) {
    return state
  }

  return {
    ...state,
    cursorId: visibleList[targetIndex],
    isEditing: preserveEditing ? state.isEditing : false,
    editBuffer: preserveEditing ? state.editBuffer : '',
    editOriginal: preserveEditing ? state.editOriginal : '',
  }
}

function withDocChange(state, mutator) {
  const nextDoc = cloneDocument(state.doc)
  const result = mutator(nextDoc, state) ?? { changed: false }

  if (!result.changed) {
    return state
  }

  const historyPast = appendHistory(state.historyPast, cloneDocument(state.doc))
  const nextState = {
    ...state,
    doc: nextDoc,
    cursorId: result.cursorId ?? state.cursorId,
    isEditing: result.isEditing ?? false,
    editBuffer: result.editBuffer ?? '',
    editOriginal: result.editOriginal ?? '',
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
      isEditing: true,
      editBuffer: '',
      editOriginal: '',
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
      cursorId: node.id,
      isEditing: state.isEditing,
      editBuffer: state.editBuffer,
      editOriginal: state.editOriginal,
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

    if (parent.id === doc.rootId) {
      current.parentId = doc.rootId
      doc.nodes[doc.rootId].childrenIds.push(current.id)
      return {
        changed: true,
        cursorId: current.id,
        isEditing: state.isEditing,
        editBuffer: state.editBuffer,
        editOriginal: state.editOriginal,
      }
    }

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
      cursorId: current.id,
      isEditing: state.isEditing,
      editBuffer: state.editBuffer,
      editOriginal: state.editOriginal,
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
      cursorId: result.cursorId ?? doc.rootId,
      isEditing: false,
      editBuffer: '',
      editOriginal: '',
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
      cursorId: state.cursorId,
      isEditing: state.isEditing,
      editBuffer: state.editBuffer,
      editOriginal: state.editOriginal,
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
  if (startIndex === -1) {
    return state
  }

  const subtreeSize = getSubtreeIds(state.doc, current.id).length
  const endIndex = startIndex + subtreeSize - 1

  if (endIndex >= visibleList.length - 1) {
    return state
  }

  const nextRowId = visibleList[endIndex + 1]
  if (!nextRowId) {
    return state
  }

  return withDocChange(state, (doc) => {
    const moved = moveNodeAfter(doc, state.cursorId, nextRowId)
    if (!moved) {
      return { changed: false }
    }

    return {
      changed: true,
      cursorId: state.cursorId,
      isEditing: state.isEditing,
      editBuffer: state.editBuffer,
      editOriginal: state.editOriginal,
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
          cursorId: nodeId,
          isEditing: false,
          editBuffer: '',
          editOriginal: '',
        }
      })
    },

    moveUp() {
      update((state) => moveCursorByOffset(state, -1))
    },

    moveDown() {
      update((state) => moveCursorByOffset(state, 1))
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
          isEditing: true,
          editBuffer: node.name,
          editOriginal: node.name,
        }
      })
    },

    setEditBuffer(value) {
      update((state) => {
        if (!state.isEditing) {
          return state
        }
        return {
          ...state,
          editBuffer: sanitizeName(value),
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

        if (!state.isEditing) {
          return {
            ...state,
            isEditing: true,
            editBuffer: `${node.name}${char}`,
            editOriginal: node.name,
          }
        }

        return {
          ...state,
          editBuffer: `${state.editBuffer}${char}`,
        }
      })
    },

    confirmEdit() {
      update((state) => {
        if (!state.isEditing) {
          return state
        }

        const node = state.doc.nodes[state.cursorId]
        if (!node) {
          return {
            ...state,
            isEditing: false,
            editBuffer: '',
            editOriginal: '',
          }
        }

        const nextName = sanitizeName(state.editBuffer)

        if (nextName === '') {
          if (node.id === state.doc.rootId) {
            return {
              ...state,
              isEditing: false,
              editBuffer: '',
              editOriginal: '',
            }
          }

          return withDocChange(state, (doc) => {
            const result = removeNodeAndPromoteChildren(doc, state.cursorId)
            if (!result.changed) {
              return { changed: false }
            }

            return {
              changed: true,
              cursorId: result.cursorId ?? doc.rootId,
              isEditing: false,
              editBuffer: '',
              editOriginal: '',
            }
          })
        }

        if (node.name === nextName) {
          return {
            ...state,
            isEditing: false,
            editBuffer: '',
            editOriginal: '',
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
            cursorId: nextNode.id,
            isEditing: false,
            editBuffer: '',
            editOriginal: '',
          }
        })
      })
    },

    cancelEdit() {
      update((state) => {
        if (!state.isEditing) {
          return state
        }
        return {
          ...state,
          isEditing: false,
          editBuffer: '',
          editOriginal: '',
        }
      })
    },

    undo() {
      update((state) => {
        if (state.historyPast.length === 0) {
          return state
        }

        const previousDoc = cloneDocument(state.historyPast[state.historyPast.length - 1])
        const nextPast = state.historyPast.slice(0, -1)
        const nextFuture = [cloneDocument(state.doc), ...state.historyFuture].slice(0, HISTORY_LIMIT)
        const cursorId = previousDoc.nodes[state.cursorId] ? state.cursorId : previousDoc.rootId

        saveDocumentToStorage(previousDoc)

        return {
          ...state,
          doc: previousDoc,
          cursorId,
          isEditing: false,
          editBuffer: '',
          editOriginal: '',
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
        const nextDoc = cloneDocument(nextDocRaw)
        const nextPast = appendHistory(state.historyPast, cloneDocument(state.doc))
        const cursorId = nextDoc.nodes[state.cursorId] ? state.cursorId : nextDoc.rootId

        saveDocumentToStorage(nextDoc)

        return {
          ...state,
          doc: nextDoc,
          cursorId,
          isEditing: false,
          editBuffer: '',
          editOriginal: '',
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
