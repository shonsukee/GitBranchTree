import { describe, expect, it } from 'vitest'
import { DOUBLE_TAP_THRESHOLD_MS, createDoubleTapDetector } from './doubleTap'

describe('doubleTap', () => {
  it('returns false on first tap', () => {
    const detector = createDoubleTapDetector()

    expect(detector('node-a', 1000)).toBe(false)
  })

  it('returns true for same node within threshold', () => {
    const detector = createDoubleTapDetector()

    detector('node-a', 1000)

    expect(detector('node-a', 1800)).toBe(true)
  })

  it('returns false for same node over threshold', () => {
    const detector = createDoubleTapDetector()

    detector('node-a', 1000)

    expect(detector('node-a', 1000 + DOUBLE_TAP_THRESHOLD_MS + 1)).toBe(false)
  })

  it('returns false when tapping different nodes', () => {
    const detector = createDoubleTapDetector()

    detector('node-a', 1000)

    expect(detector('node-b', 1300)).toBe(false)
  })
})
