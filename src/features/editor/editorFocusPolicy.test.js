import { describe, expect, it } from 'vitest'
import { getEditorInputId, shouldRefocusEditor } from './editorFocusPolicy'

describe('editorFocusPolicy', () => {
  it('returns false for non-editor modes', () => {
    expect(shouldRefocusEditor({ mode: 'focus', cursorId: 'a' }, { mode: 'focus', cursorId: 'a' }, null)).toBe(false)
  })

  it('returns true when entering editor mode', () => {
    expect(shouldRefocusEditor({ mode: 'focus', cursorId: 'a' }, { mode: 'name', cursorId: 'a' }, null)).toBe(true)
  })

  it('returns true when switching cursor in same mode', () => {
    expect(shouldRefocusEditor({ mode: 'comment', cursorId: 'a' }, { mode: 'comment', cursorId: 'b' }, null)).toBe(true)
  })

  it('returns false while typing on same input', () => {
    const activeId = getEditorInputId('name', 'a')
    expect(shouldRefocusEditor({ mode: 'name', cursorId: 'a' }, { mode: 'name', cursorId: 'a' }, activeId)).toBe(false)
  })

  it('returns true when active element is different from expected editor input', () => {
    expect(shouldRefocusEditor({ mode: 'name', cursorId: 'a' }, { mode: 'name', cursorId: 'a' }, 'other')).toBe(true)
  })
})
