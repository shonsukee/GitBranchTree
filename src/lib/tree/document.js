import { computeVisibleList } from './traversal'

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
