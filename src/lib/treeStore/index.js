import { createTreeStore } from './createTreeStore'
import { loadDocumentFromStorage, saveDocumentToStorage } from './storage'

export { createTreeStore } from './createTreeStore'
export { STORAGE_KEY, HISTORY_LIMIT, MODE_FOCUS, MODE_NAME, MODE_COMMENT } from './constants'

export const treeStore = createTreeStore()

export { loadDocumentFromStorage as loadFromStorage, saveDocumentToStorage as saveToStorage }
