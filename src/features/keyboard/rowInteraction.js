export function shouldActivateRowFromKeydown(key, targetIsCurrentTarget) {
  if (!targetIsCurrentTarget) {
    return false
  }
  return key === 'Enter' || key === ' '
}
