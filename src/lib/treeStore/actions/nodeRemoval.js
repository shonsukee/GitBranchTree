export function removeNodeAndPromoteChildren(doc, nodeId) {
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
