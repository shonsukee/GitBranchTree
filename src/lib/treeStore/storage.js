import { migrateLegacyEmptyNodes, normalizeDocument } from '../tree'
import { STORAGE_KEY } from './constants'

function hasLocalStorage() {
  return (
    typeof localStorage !== 'undefined' &&
    localStorage !== null &&
    typeof localStorage.getItem === 'function' &&
    typeof localStorage.setItem === 'function'
  )
}

export function loadDocumentFromStorage() {
  if (!hasLocalStorage()) {
    return null
  }

  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)
    const normalized = normalizeDocument(parsed)
    return migrateLegacyEmptyNodes(normalized)
  } catch (error) {
    console.error('Failed to restore GitBranchTree document from localStorage', error)
    return null
  }
}

export function saveDocumentToStorage(doc) {
  if (!hasLocalStorage()) {
    return
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc))
  } catch (error) {
    console.error('Failed to save GitBranchTree document to localStorage', error)
  }
}
