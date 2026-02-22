export function computeVisibleList(doc) {
  const result = []

  if (!doc || !doc.nodes || !doc.rootId || !doc.nodes[doc.rootId]) {
    return result
  }

  const visited = new Set()

  const walk = (nodeId) => {
    if (visited.has(nodeId)) {
      return
    }

    const node = doc.nodes[nodeId]
    if (!node) {
      return
    }

    visited.add(nodeId)
    result.push(nodeId)

    for (const childId of node.childrenIds) {
      walk(childId)
    }
  }

  walk(doc.rootId)
  return result
}

export function getDepth(doc, nodeId) {
  if (!doc || !doc.nodes || !doc.nodes[nodeId]) {
    return 0
  }

  let depth = 0
  let currentId = nodeId
  const visited = new Set()

  while (doc.nodes[currentId] && doc.nodes[currentId].parentId) {
    if (visited.has(currentId)) {
      break
    }
    visited.add(currentId)
    depth += 1
    currentId = doc.nodes[currentId].parentId
  }

  return depth
}

export function getSubtreeIds(doc, nodeId) {
  const subtreeIds = []
  const visited = new Set()

  const walk = (currentId) => {
    if (visited.has(currentId)) {
      return
    }

    const node = doc.nodes[currentId]
    if (!node) {
      return
    }

    visited.add(currentId)
    subtreeIds.push(currentId)

    for (const childId of node.childrenIds) {
      walk(childId)
    }
  }

  walk(nodeId)
  return subtreeIds
}

export function computeVisibleRows(doc) {
  if (!doc || !doc.nodes || !doc.rootId || !doc.nodes[doc.rootId]) {
    return []
  }

  const rows = []
  const visited = new Set()

  const walk = (nodeId, prefixGuides, isRoot, isLast) => {
    if (visited.has(nodeId)) {
      return
    }

    const node = doc.nodes[nodeId]
    if (!node) {
      return
    }

    visited.add(nodeId)
    rows.push({
      id: nodeId,
      depth: prefixGuides.length,
      isRoot,
      prefixGuides: [...prefixGuides],
      connector: isRoot ? '' : isLast ? '└──' : '├──',
    })

    const children = node.childrenIds.filter((childId) => doc.nodes[childId])
    children.forEach((childId, index) => {
      walk(childId, [...prefixGuides, !isLast], false, index === children.length - 1)
    })
  }

  walk(doc.rootId, [], true, true)
  return rows
}
