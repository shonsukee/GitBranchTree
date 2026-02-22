function escapeMermaidString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function shortId(nodeId) {
  const normalized = String(nodeId).replace(/[^A-Za-z0-9]/g, '')
  if (normalized.length === 0) {
    return 'node'
  }
  return normalized.slice(0, 8)
}

function sanitizeBranchBase(name, nodeId) {
  const raw = typeof name === 'string' ? name : ''
  const sanitized = raw.replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
  const base = sanitized.length > 0 ? sanitized : `b_${shortId(nodeId)}`
  return /^[A-Za-z_]/.test(base) ? base : `b_${base}`
}

function toMermaidBranchKey(nodeName, nodeId, used) {
  const base = sanitizeBranchBase(nodeName, nodeId)
  let candidate = base
  let suffix = 2

  while (used.has(candidate)) {
    candidate = `${base}_${suffix}`
    suffix += 1
  }

  used.add(candidate)
  return candidate
}

function safeCommitId(name, nodeId) {
  const raw = typeof name === 'string' && name.length > 0 ? name : `node-${shortId(nodeId)}`
  return escapeMermaidString(raw)
}

export function serializeMermaidGitGraph(doc) {
  if (!doc || !doc.nodes || !doc.rootId || !doc.nodes[doc.rootId]) {
    return 'gitGraph'
  }

  const lines = ['gitGraph']
  const root = doc.nodes[doc.rootId]
  lines.push(`  commit id:"${safeCommitId(root.name, root.id)}"`)

  const usedBranchKeys = new Set(['main'])
  const visited = new Set([root.id])
  let rootBranch = 'main'

  const rootBase = sanitizeBranchBase(root.name, root.id)
  if (rootBase !== 'main') {
    let rootBranchCandidate = rootBase
    let suffix = 2
    while (usedBranchKeys.has(rootBranchCandidate)) {
      rootBranchCandidate = `${rootBase}_${suffix}`
      suffix += 1
    }

    usedBranchKeys.add(rootBranchCandidate)
    lines.push(`  branch ${rootBranchCandidate}`)
    lines.push(`  checkout ${rootBranchCandidate}`)
    rootBranch = rootBranchCandidate
  }

  const walk = (parentId, parentBranch) => {
    const parent = doc.nodes[parentId]
    if (!parent) {
      return
    }

    for (const childId of parent.childrenIds) {
      const child = doc.nodes[childId]
      if (!child || visited.has(child.id)) {
        continue
      }

      const childBranch = toMermaidBranchKey(child.name, child.id, usedBranchKeys)
      lines.push(`  checkout ${parentBranch}`)
      lines.push(`  branch ${childBranch}`)
      lines.push(`  checkout ${childBranch}`)
      lines.push(`  commit id:"${safeCommitId(child.name, child.id)}"`)

      visited.add(child.id)
      walk(child.id, childBranch)
    }
  }

  walk(root.id, rootBranch)
  return lines.join('\n')
}
