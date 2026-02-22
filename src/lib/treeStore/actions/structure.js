export function createStructureActions({
  withDocChange,
  generateNodeId,
  preserveModeFields,
  focusFields,
  removeNodeAndPromoteChildren,
  moveCursorByOffset,
}) {
  function createEmptyNode(nodeId) {
    return {
      id: nodeId,
      name: '',
      comment: '',
      parentId: null,
      childrenIds: [],
    }
  }

  function createEditingResult(nodeId) {
    return {
      changed: true,
      cursorId: nodeId,
      mode: 'name',
      nameBuffer: '',
      nameOriginal: '',
      commentBuffer: '',
      commentOriginal: '',
    }
  }

  function insertBelowState(state) {
    return withDocChange(state, (doc) => {
      const cursorNode = doc.nodes[state.cursorId]
      if (!cursorNode) {
        return { changed: false }
      }

      const nodeId = generateNodeId()
      doc.nodes[nodeId] = createEmptyNode(nodeId)

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

      return createEditingResult(nodeId)
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
        ...createEmptyNode(nodeId),
        parentId: cursorNode.id,
      }
      cursorNode.childrenIds.unshift(nodeId)

      return createEditingResult(nodeId)
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

  return {
    insertBelowState,
    insertChildTopState,
    indentRightState,
    outdentLeftState,
    deleteNodeState,
  }
}
