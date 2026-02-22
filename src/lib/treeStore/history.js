export function appendHistory(history, docSnapshot, limit) {
  if (history.length < limit) {
    return [...history, docSnapshot]
  }
  return [...history.slice(1), docSnapshot]
}
