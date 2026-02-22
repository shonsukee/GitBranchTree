<script>
  import { get } from 'svelte/store'
  import { onDestroy, tick } from 'svelte'
  import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome'
  import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons'
  import TreePanel from './components/tree/TreePanel.svelte'
  import ExportModal from './components/modals/ExportModal.svelte'
  import HelpModal from './components/modals/HelpModal.svelte'
  import BottomActionBar from './components/mobile/BottomActionBar.svelte'
  import { treeStore } from './lib/treeStore'
  import { buildAsciiRowsWithComments, computeVisibleRows } from './lib/tree'
  import { shouldRefocusEditor, getEditorInputId } from './features/editor/editorFocusPolicy'
  import { createGlobalKeydownHandler } from './features/keyboard/globalKeyHandler'
  import { isCommentToInputShortcut, isRedoShortcut, isUndoShortcut } from './features/keyboard/keyMap'
  import { EXPORT_FORMAT_ASCII, buildExportText, formatLabel } from './features/export/exportFormats'
  import { createDoubleTapDetector } from './features/interaction/doubleTap'

  const THEME_STORAGE_KEY = 'gitbranchtree.theme.v1'
  const focusOnlyBottomActions = new Set(['add-child', 'indent', 'outdent'])
  const registerNameTap = createDoubleTapDetector()

  const byPrefixAndName = {
    fas: {
      moon: faMoon,
      sun: faSun,
    },
  }

  let state = get(treeStore)
  let exportOpen = false
  let helpOpen = false
  let exportFormat = EXPORT_FORMAT_ASCII
  let exportText = ''
  let copyMessage = ''
  let focusRequestId = 0
  let theme = getInitialTheme()
  let gSequenceArmed = false
  let gSequenceTimer = null

  $: applyTheme(theme)

  const unsubscribe = treeStore.subscribe((nextState) => {
    const prevState = state
    state = nextState

    const activeElementId = typeof document !== 'undefined' ? document.activeElement?.id ?? null : null
    if (shouldRefocusEditor(prevState, nextState, activeElementId)) {
      const shouldMoveCaretToEnd = !prevState || prevState.mode !== nextState.mode || prevState.cursorId !== nextState.cursorId
      focusCurrentEditor(nextState.cursorId, nextState.mode, shouldMoveCaretToEnd)
    }

    if (exportOpen) {
      refreshExportText()
    }
  })

  onDestroy(() => {
    resetGSequence()
    unsubscribe()
  })

  function hasThemeStorage() {
    return (
      typeof localStorage !== 'undefined' &&
      localStorage !== null &&
      typeof localStorage.getItem === 'function' &&
      typeof localStorage.setItem === 'function'
    )
  }

  function getInitialTheme() {
    if (typeof window === 'undefined') {
      return 'light'
    }

    if (hasThemeStorage()) {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
      if (storedTheme === 'light' || storedTheme === 'dark') {
        return storedTheme
      }
    }

    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  }

  function applyTheme(value) {
    if (typeof document === 'undefined') {
      return
    }
    document.documentElement.dataset.theme = value
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark'
    if (hasThemeStorage()) {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    }
  }

  function resetGSequence() {
    gSequenceArmed = false
    if (gSequenceTimer) {
      clearTimeout(gSequenceTimer)
      gSequenceTimer = null
    }
  }

  function armGSequence() {
    resetGSequence()
    gSequenceArmed = true
    gSequenceTimer = setTimeout(() => {
      resetGSequence()
    }, 450)
  }

  async function focusCurrentEditor(nodeId, mode, placeCaretAtEnd = false) {
    const requestId = ++focusRequestId
    await tick()

    if (requestId !== focusRequestId) {
      return
    }

    const inputId = getEditorInputId(mode, nodeId)
    if (!inputId) {
      return
    }

    const input = document.getElementById(inputId)
    if (!input) {
      return
    }

    if (document.activeElement !== input) {
      input.focus()
    }

    if (placeCaretAtEnd && typeof input.setSelectionRange === 'function') {
      input.setSelectionRange(input.value.length, input.value.length)
    }
  }

  function rowsFromState(editorState) {
    if (!editorState) {
      return []
    }

    const metaRows = computeVisibleRows(editorState.doc)
    const asciiRows = buildAsciiRowsWithComments(editorState.doc)
    const asciiById = new Map(asciiRows.map((row) => [row.id, row]))

    return metaRows.map((row) => {
      const node = editorState.doc.nodes[row.id]
      const asciiRow = asciiById.get(row.id)
      const commentPadding = asciiRow ? Math.max(4, asciiRow.maxLeftLength - asciiRow.leftLength + 4) : 4

      return {
        ...row,
        node,
        commentPadding,
      }
    })
  }

  function branchPrefix(row) {
    const visibleGuides = row.depth > 0 ? row.prefixGuides.slice(1) : row.prefixGuides
    const guides = visibleGuides.map((hasGuide) => (hasGuide ? '│   ' : '    ')).join('')
    if (row.isRoot) {
      return guides
    }
    return `${guides}${row.connector} `
  }

  function ensureCommentSaved() {
    if (state.mode === 'comment') {
      treeStore.confirmCommentEdit()
    }
  }

  function ensureNameSaved() {
    if (state.mode === 'name') {
      treeStore.confirmEdit()
    }
  }

  function getState() {
    return state
  }

  function isExportOpen() {
    return exportOpen
  }

  function isHelpOpen() {
    return helpOpen
  }

  const handleGlobalKeydownInternal = createGlobalKeydownHandler({
    getState,
    isExportOpen,
    closeExportModal,
    isHelpOpen,
    closeHelpModal,
    openHelpModal,
    resetGSequence,
    armGSequence,
    isGSequenceArmed: () => gSequenceArmed,
    treeStore,
  })

  function handleGlobalKeydown(event) {
    handleGlobalKeydownInternal(event)
  }

  function handleNameInput(event) {
    treeStore.setEditBuffer(event.detail.value)
  }

  function handleNameKeydown(event) {
    const keyEvent = event.detail
    keyEvent.stopPropagation()

    if (isUndoShortcut(keyEvent)) {
      keyEvent.preventDefault()
      resetGSequence()
      treeStore.undo()
      return
    }

    if (isRedoShortcut(keyEvent)) {
      keyEvent.preventDefault()
      resetGSequence()
      treeStore.redo()
      return
    }

    if (keyEvent.key === 'Escape') {
      keyEvent.preventDefault()
      treeStore.confirmEdit()
      return
    }

    if (keyEvent.key === 'Enter') {
      keyEvent.preventDefault()
      treeStore.confirmEdit()
      return
    }

    if (keyEvent.key === 'Tab') {
      keyEvent.preventDefault()
      if (keyEvent.shiftKey) {
        treeStore.outdentLeft()
      } else {
        treeStore.indentRight()
      }
    }
  }

  function handleNameBlur() {
    treeStore.confirmEdit()
  }

  function handleCommentInput(event) {
    treeStore.setCommentBuffer(event.detail.value)
  }

  function handleCommentKeydown(event) {
    const keyEvent = event.detail
    keyEvent.stopPropagation()

    if (isUndoShortcut(keyEvent)) {
      keyEvent.preventDefault()
      resetGSequence()
      treeStore.undo()
      return
    }

    if (isRedoShortcut(keyEvent)) {
      keyEvent.preventDefault()
      resetGSequence()
      treeStore.redo()
      return
    }

    if (isCommentToInputShortcut(keyEvent)) {
      keyEvent.preventDefault()
      resetGSequence()
      treeStore.confirmCommentEdit()
      treeStore.startEdit()
      return
    }

    if (keyEvent.key === 'ArrowUp') {
      keyEvent.preventDefault()
      resetGSequence()
      treeStore.moveUp()
      return
    }

    if (keyEvent.key === 'ArrowDown') {
      keyEvent.preventDefault()
      resetGSequence()
      treeStore.moveDown()
      return
    }

    if (keyEvent.key === 'Escape') {
      keyEvent.preventDefault()
      treeStore.confirmCommentEdit()
      return
    }

    if (keyEvent.key === 'Enter') {
      keyEvent.preventDefault()
      treeStore.confirmCommentEdit()
      return
    }

    if (keyEvent.key === 'Tab') {
      keyEvent.preventDefault()
    }
  }

  function selectNode(nodeId) {
    if (state.cursorId === nodeId && (state.mode === 'name' || state.mode === 'comment')) {
      return
    }

    ensureNameSaved()
    ensureCommentSaved()
    treeStore.selectCursor(nodeId)
  }

  function handleRowSelect(event) {
    selectNode(event.detail.nodeId)
  }

  function handleNameTap(event) {
    if (state.mode !== 'focus') {
      return
    }

    const { nodeId, timeStamp } = event.detail
    const isDoubleTap = registerNameTap(nodeId, timeStamp)
    if (!isDoubleTap) {
      return
    }

    selectNode(nodeId)
    treeStore.startEdit()
  }

  function refreshExportText() {
    exportText = buildExportText(exportFormat, treeStore)
  }

  function openExportModal() {
    ensureNameSaved()
    ensureCommentSaved()
    helpOpen = false
    refreshExportText()
    copyMessage = ''
    exportOpen = true
  }

  function closeExportModal() {
    copyMessage = ''
    exportOpen = false
  }

  function handleExportFormatChange(event) {
    exportFormat = event.detail.format
    refreshExportText()
    copyMessage = ''
  }

  function openHelpModal() {
    ensureNameSaved()
    ensureCommentSaved()
    exportOpen = false
    copyMessage = ''
    helpOpen = true
  }

  function closeHelpModal() {
    helpOpen = false
  }

  function handleBottomAction(event) {
    const { action } = event.detail

    if (focusOnlyBottomActions.has(action) && state.mode !== 'focus') {
      return
    }

    resetGSequence()

    if (action === 'up') {
      if (state.mode === 'name') {
        return
      }
      treeStore.moveUp()
      return
    }
    if (action === 'down') {
      if (state.mode === 'name') {
        return
      }
      treeStore.moveDown()
      return
    }
    if (action === 'add-child') {
      treeStore.insertChildTop()
      return
    }
    if (action === 'indent') {
      treeStore.indentRight()
      return
    }
    if (action === 'outdent') {
      treeStore.outdentLeft()
      return
    }
    if (action === 'input') {
      if (state.mode === 'name') {
        treeStore.confirmEdit()
        return
      }
      if (state.mode === 'comment') {
        treeStore.confirmCommentEdit()
        treeStore.startEdit()
        return
      }
      if (state.mode === 'focus') {
        treeStore.startEdit()
      }
      return
    }
    if (action === 'comment') {
      if (state.mode === 'comment') {
        treeStore.confirmCommentEdit()
        return
      }
      if (state.mode === 'name') {
        treeStore.confirmEdit()
        treeStore.startCommentEdit()
        return
      }
      if (state.mode === 'focus') {
        treeStore.startCommentEdit()
      }
      return
    }
    if (action === 'help') {
      openHelpModal()
      return
    }
    if (action === 'export') {
      openExportModal()
    }
  }

  async function copyExportText() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(exportText)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = exportText
        textarea.setAttribute('readonly', 'readonly')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      copyMessage = `Copied ${formatLabel(exportFormat)}`
    } catch (error) {
      copyMessage = 'Copy failed'
    }
  }

  function modeLabel(mode) {
    if (mode === 'name') {
      return 'INPUT'
    }
    if (mode === 'comment') {
      return 'COMMENT'
    }
    return 'FOCUS'
  }
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<main class="app">
  <header class="toolbar">
    <div>
      <h1>GitBranchTree</h1>
      <p>Neo Console branch editor for keyboard and touch</p>
    </div>
    <div class="toolbar-actions">
      <span class="mode-chip" aria-live="polite">{modeLabel(state.mode)}</span>
      <button class="theme-button" onclick={toggleTheme} aria-label="Toggle theme">
        {#if theme === 'dark'}
          <FontAwesomeIcon icon={byPrefixAndName.fas['sun']} />
        {:else}
          <FontAwesomeIcon icon={byPrefixAndName.fas['moon']} />
        {/if}
      </button>
      <button class="export-button" onclick={openExportModal}>Export</button>
    </div>
  </header>

  <TreePanel
    rows={rowsFromState(state)}
    {state}
    {branchPrefix}
    on:select={handleRowSelect}
    on:nameTap={handleNameTap}
    on:nameInput={handleNameInput}
    on:nameKeydown={handleNameKeydown}
    on:nameBlur={handleNameBlur}
    on:commentInput={handleCommentInput}
    on:commentKeydown={handleCommentKeydown}
  />

  <BottomActionBar hidden={exportOpen || helpOpen} mode={state.mode} on:action={handleBottomAction} />

  <HelpModal open={helpOpen} on:close={closeHelpModal} />

  <ExportModal
    open={exportOpen}
    format={exportFormat}
    text={exportText}
    {copyMessage}
    on:close={closeExportModal}
    on:copy={copyExportText}
    on:changeFormat={handleExportFormatChange}
  />
</main>
