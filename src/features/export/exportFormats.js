export const EXPORT_FORMAT_ASCII = 'ascii'
export const EXPORT_FORMAT_MERMAID = 'mermaid'

export function formatLabel(format) {
  return format === EXPORT_FORMAT_MERMAID ? 'Mermaid' : 'ASCII'
}

export function wrapMermaidCodeFence(mermaidText) {
  const body = typeof mermaidText === 'string' ? mermaidText : ''
  return `\`\`\`mermaid\n${body}\n\`\`\``
}

export function buildExportText(format, store) {
  if (format === EXPORT_FORMAT_MERMAID) {
    return wrapMermaidCodeFence(store.exportMermaidGitGraph())
  }
  return store.exportAscii()
}
