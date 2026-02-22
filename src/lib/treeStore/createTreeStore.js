import { get, writable } from 'svelte/store'
import {
  cloneDocument,
  computeVisibleList,
  createInitialDocument,
  generateNodeId,
  migrateLegacyEmptyNodes,
  serializeAsciiTree,
  serializeMermaidGitGraph,
} from '../tree'
import { HISTORY_LIMIT, MODE_COMMENT, MODE_FOCUS, MODE_NAME } from './constants'
import { appendHistory } from './history'
import { loadDocumentFromStorage, saveDocumentToStorage } from './storage'
import {
  commentFieldsFromDoc,
  createEditModeActions,
  emptyBuffers,
  focusFields,
  nameFieldsFromDoc,
  normalizeCursorId,
  preserveModeFields,
  sanitizeName,
} from './actions/editMode'
import { createCursorActions } from './actions/cursor'
import { createStructureActions } from './actions/structure'
import { createBranchMoveActions } from './actions/branchMove'
import { removeNodeAndPromoteChildren } from './actions/nodeRemoval'

function buildInitialState(doc) {
  return {
    doc,
    ...focusFields(doc.rootId),
    historyPast: [],
    historyFuture: [],
  }
}

export function createTreeStore() {
  const restoredDoc = loadDocumentFromStorage()
  const initialDoc = restoredDoc ?? createInitialDocument()
  const internalStore = writable(buildInitialState(initialDoc))
  const { subscribe, update, set } = internalStore

  if (!restoredDoc) {
    saveDocumentToStorage(initialDoc)
  }

  const { moveCursorByOffset, moveCursorToBoundary } = createCursorActions({
    computeVisibleList,
    focusFields,
    commentFieldsFromDoc,
    nameFieldsFromDoc,
  })

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

    const historyPast = appendHistory(state.historyPast, cloneDocument(state.doc), HISTORY_LIMIT)
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

  const structureActions = createStructureActions({
    withDocChange,
    generateNodeId,
    preserveModeFields,
    focusFields,
    removeNodeAndPromoteChildren,
    moveCursorByOffset,
  })

  const { moveBranchDownState, moveBranchUpState } = createBranchMoveActions({
    withDocChange,
    computeVisibleList,
    preserveModeFields,
  })

  const { confirmCommentEditState, confirmNameEditState } = createEditModeActions({
    withDocChange,
    removeNodeAndPromoteChildren,
  })

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
      update((state) => structureActions.insertBelowState(state))
    },

    insertChildTop() {
      update((state) => structureActions.insertChildTopState(state))
    },

    indentRight() {
      update((state) => structureActions.indentRightState(state))
    },

    outdentLeft() {
      update((state) => structureActions.outdentLeftState(state))
    },

    clearName() {
      update((state) => structureActions.deleteNodeState(state))
    },

    deleteNode() {
      update((state) => structureActions.deleteNodeState(state))
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
          return structureActions.indentRightState(state)
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
          commentBuffer: value,
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
        const nextFuture = [migrateLegacyEmptyNodes(cloneDocument(state.doc)), ...state.historyFuture].slice(0, HISTORY_LIMIT)
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
        const nextPast = appendHistory(state.historyPast, migrateLegacyEmptyNodes(cloneDocument(state.doc)), HISTORY_LIMIT)
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

    exportMermaidGitGraph() {
      const state = get(internalStore)
      return serializeMermaidGitGraph(state.doc)
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
