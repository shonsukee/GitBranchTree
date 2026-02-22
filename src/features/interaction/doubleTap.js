export const DOUBLE_TAP_THRESHOLD_MS = 1000

function toComparableTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  return Date.now()
}

export function createDoubleTapDetector({ thresholdMs = DOUBLE_TAP_THRESHOLD_MS } = {}) {
  let lastTapNodeId = null
  let lastTapTimestamp = null

  return function registerTap(nodeId, timestamp) {
    const currentTimestamp = toComparableTimestamp(timestamp)
    const isSameNode = lastTapNodeId === nodeId
    const delta = lastTapTimestamp === null ? Number.POSITIVE_INFINITY : currentTimestamp - lastTapTimestamp
    const isDoubleTap = isSameNode && delta >= 0 && delta <= thresholdMs

    lastTapNodeId = nodeId
    lastTapTimestamp = currentTimestamp

    return isDoubleTap
  }
}
