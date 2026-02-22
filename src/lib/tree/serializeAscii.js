import { computeVisibleRows } from './traversal'

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
