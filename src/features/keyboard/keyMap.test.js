import { describe, expect, it } from 'vitest'
import { isCommentToInputShortcut } from './keyMap'

describe('keyMap.isCommentToInputShortcut', () => {
  it('returns true for Ctrl+I and Cmd+I', () => {
    expect(isCommentToInputShortcut({ key: 'i', code: 'KeyI', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false })).toBe(true)
    expect(isCommentToInputShortcut({ key: 'I', code: 'KeyI', ctrlKey: false, metaKey: true, shiftKey: false, altKey: false })).toBe(true)
  })

  it('returns false for plain, shift, and alt modified i', () => {
    expect(isCommentToInputShortcut({ key: 'i', code: 'KeyI', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false })).toBe(false)
    expect(isCommentToInputShortcut({ key: 'I', code: 'KeyI', ctrlKey: true, metaKey: false, shiftKey: true, altKey: false })).toBe(false)
    expect(isCommentToInputShortcut({ key: 'i', code: 'KeyI', ctrlKey: true, metaKey: false, shiftKey: false, altKey: true })).toBe(false)
  })

  it('returns false for non-i key', () => {
    expect(isCommentToInputShortcut({ key: 'k', code: 'KeyK', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false })).toBe(false)
  })
})
