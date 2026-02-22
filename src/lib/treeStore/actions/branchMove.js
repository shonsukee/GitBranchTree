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

export function createBranchMoveActions({ withDocChange, computeVisibleList, preserveModeFields }) {
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

  return {
    moveBranchUpState,
    moveBranchDownState,
  }
}
