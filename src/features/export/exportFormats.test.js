import { describe, expect, it, vi } from 'vitest'
import { buildExportText, EXPORT_FORMAT_ASCII, EXPORT_FORMAT_MERMAID, wrapMermaidCodeFence } from './exportFormats'

describe('exportFormats', () => {
  it('wraps Mermaid export in fenced code block', () => {
    const store = {
      exportAscii: vi.fn(() => 'main'),
      exportMermaidGitGraph: vi.fn(() => 'gitGraph\n  commit id:"main"'),
    }

    const text = buildExportText(EXPORT_FORMAT_MERMAID, store)

    expect(text).toBe('```mermaid\ngitGraph\n  commit id:"main"\n```')
    expect(store.exportMermaidGitGraph).toHaveBeenCalledTimes(1)
    expect(store.exportAscii).not.toHaveBeenCalled()
  })

  it('keeps ASCII export unchanged', () => {
    const store = {
      exportAscii: vi.fn(() => 'main\n└── develop'),
      exportMermaidGitGraph: vi.fn(() => 'gitGraph'),
    }

    const text = buildExportText(EXPORT_FORMAT_ASCII, store)

    expect(text).toBe('main\n└── develop')
    expect(store.exportAscii).toHaveBeenCalledTimes(1)
    expect(store.exportMermaidGitGraph).not.toHaveBeenCalled()
  })

  it('wrapMermaidCodeFence handles non-string values', () => {
    expect(wrapMermaidCodeFence(null)).toBe('```mermaid\n\n```')
  })
})
