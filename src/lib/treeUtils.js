export function generateNodeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `node-${Math.random().toString(36).slice(2, 10)}`
}

export function createInitialDocument() {
  const rootId = generateNodeId()

  return {
    rootId,
    nodes: {
      [rootId]: {
        id: rootId,
        name: 'main',
        comment: '',
        parentId: null,
        childrenIds: [],
      },
    },
  }
}

export function cloneDocument(doc) {
  const nodes = {}

  for (const [id, node] of Object.entries(doc.nodes)) {
    nodes[id] = {
      id: node.id,
      name: node.name,
      comment: typeof node.comment === 'string' ? node.comment : '',
      parentId: node.parentId,
      childrenIds: [...node.childrenIds],
    }
  }

  return {
    rootId: doc.rootId,
    nodes,
  }
}

function isValidNodeShape(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    (value.parentId === null || typeof value.parentId === 'string') &&
    Array.isArray(value.childrenIds)
  )
}

function sanitizeChildren(childrenIds, nodes, ownerId) {
  const unique = new Set()
  const result = []

  for (const childId of childrenIds) {
    if (typeof childId !== 'string') {
      continue
    }
    if (childId === ownerId) {
      continue
    }
    if (!nodes[childId]) {
      continue
    }
    if (unique.has(childId)) {
      continue
    }
    unique.add(childId)
    result.push(childId)
  }

  return result
}

export function normalizeDocument(rawDoc) {
  if (!rawDoc || typeof rawDoc !== 'object') {
    throw new Error('Document must be an object')
  }
  if (typeof rawDoc.rootId !== 'string') {
    throw new Error('Document rootId must be a string')
  }
  if (!rawDoc.nodes || typeof rawDoc.nodes !== 'object') {
    throw new Error('Document nodes must be an object')
  }

  const nodes = {}
  for (const [id, rawNode] of Object.entries(rawDoc.nodes)) {
    if (!isValidNodeShape(rawNode)) {
      continue
    }
    nodes[id] = {
      id,
      name: rawNode.name,
      comment: typeof rawNode.comment === 'string' ? rawNode.comment : '',
      parentId: rawNode.parentId,
      childrenIds: [...rawNode.childrenIds],
    }
  }

  if (!nodes[rawDoc.rootId]) {
    throw new Error('rootId node is missing')
  }

  for (const node of Object.values(nodes)) {
    node.childrenIds = sanitizeChildren(node.childrenIds, nodes, node.id)
    node.parentId = null
  }

  for (const node of Object.values(nodes)) {
    for (const childId of node.childrenIds) {
      const child = nodes[childId]
      if (!child || child.parentId !== null) {
        continue
      }
      child.parentId = node.id
    }
  }

  nodes[rawDoc.rootId].parentId = null

  return {
    rootId: rawDoc.rootId,
    nodes,
  }
}

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

function removeNodeAndPromoteChildren(doc, nodeId) {
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

  parent.childrenIds.splice(index, 1, ...node.childrenIds)

  for (const childId of node.childrenIds) {
    if (doc.nodes[childId]) {
      doc.nodes[childId].parentId = parent.id
    }
  }

  delete doc.nodes[node.id]
  return true
}

export function migrateLegacyEmptyNodes(doc) {
  const migrated = cloneDocument(doc)

  let changed = true
  while (changed) {
    changed = false

    for (const nodeId of computeVisibleList(migrated)) {
      const node = migrated.nodes[nodeId]
      if (!node) {
        continue
      }
      if (node.id === migrated.rootId) {
        continue
      }
      if (node.name !== '') {
        continue
      }

      if (removeNodeAndPromoteChildren(migrated, node.id)) {
        changed = true
        break
      }
    }
  }

  return migrated
}

function branchPrefixFromRow(row) {
  const visibleGuides = row.depth > 0 ? row.prefixGuides.slice(1) : row.prefixGuides
  const guides = visibleGuides.map((hasGuide) => (hasGuide ? '│   ' : '    ')).join('')
  if (row.isRoot) {
    return guides
  }
  return `${guides}${row.connector} `
}

function stringLength(value) {
  return Array.from(value).length
}

export function buildAsciiRowsWithComments(doc) {
  if (!doc || !doc.nodes || !doc.rootId || !doc.nodes[doc.rootId]) {
    return []
  }

  const rows = computeVisibleRows(doc).map((row) => {
    const node = doc.nodes[row.id]
    const left = `${branchPrefixFromRow(row)}${node.name}`
    const leftLength = stringLength(left)
    const comment = typeof node.comment === 'string' ? node.comment : ''

    return {
      id: row.id,
      left,
      leftLength,
      comment,
      maxLeftLength: 0,
      line: left,
    }
  })

  const maxLeftLength = rows.reduce((max, row) => Math.max(max, row.leftLength), 0)

  return rows.map((row) => {
    const padded = {
      ...row,
      maxLeftLength,
    }

    if (row.comment.length === 0) {
      return padded
    }

    const spaces = ' '.repeat(maxLeftLength - row.leftLength + 4)
    return {
      ...padded,
      line: `${row.left}${spaces}# ${row.comment}`,
    }
  })
}

export function serializeAsciiTree(doc) {
  const rows = buildAsciiRowsWithComments(doc)
  return rows.map((row) => row.line).join('\n')
}
