<script>
  import { get } from 'svelte/store'
  import { onDestroy, tick } from 'svelte'
  import { treeStore } from './lib/treeStore'
  import { computeVisibleRows } from './lib/treeUtils'
  import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome'
  import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons'

  const THEME_STORAGE_KEY = 'gitbranchtree.theme.v1'
  const byPrefixAndName = {
    fas: {
      moon: faMoon,
      sun: faSun,
    },
  }

  let state = get(treeStore)
  let exportOpen = false
  let exportText = ''
  let copyMessage = ''
  let focusRequestId = 0
  let theme = getInitialTheme()
  let gSequenceArmed = false
  let gSequenceTimer = null

  $: applyTheme(theme)

  const unsubscribe = treeStore.subscribe((nextState) => {
    state = nextState
    if (state.isEditing) {
      focusCurrentEditor(state.cursorId)
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

  async function focusCurrentEditor(nodeId) {
    const requestId = ++focusRequestId
    await tick()

    if (requestId !== focusRequestId) {
      return
    }

    const input = document.getElementById(`node-input-${nodeId}`)
    if (!input) {
      return
    }

    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  }

  function rowsFromState(editorState) {
    if (!editorState) {
      return []
    }

    return computeVisibleRows(editorState.doc).map((row) => ({
      ...row,
      node: editorState.doc.nodes[row.id],
    }))
  }

  function branchPrefix(row) {
    const guides = row.prefixGuides.map((hasGuide) => (hasGuide ? '│   ' : '    ')).join('')
    if (row.isRoot) {
      return guides
    }
    return `${guides}${row.connector} `
  }

  function isPrintableCharacter(event) {
    return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
  }

  function isUndoShortcut(event) {
    return (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z'
  }

  function isRedoShortcut(event) {
    const isPrimaryRedo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y'
    const isMacRedo = (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'z'
    return isPrimaryRedo || isMacRedo
  }

  function isMoveBranchUpShortcut(event) {
    return (event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'ArrowUp'
  }

  function isMoveBranchDownShortcut(event) {
    return (event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'ArrowDown'
  }

  function handleGlobalKeydown(event) {
    const key = event.key
    const code = event.code
    const isKeyI = code === 'KeyI' || key === 'i' || key === 'I'
    const isKeyG = code === 'KeyG' || key === 'g' || key === 'G'
    const isUpperG = key === 'G' || (code === 'KeyG' && event.shiftKey)
    const isMoveUpKey =
      key === 'ArrowUp' ||
      code === 'KeyK' ||
      code === 'KeyL' ||
      key === 'k' ||
      key === 'K' ||
      key === 'l' ||
      key === 'L'
    const isMoveDownKey =
      key === 'ArrowDown' ||
      code === 'KeyH' ||
      code === 'KeyJ' ||
      key === 'h' ||
      key === 'H' ||
      key === 'j' ||
      key === 'J'

    if (exportOpen) {
      if (key === 'Escape') {
        event.preventDefault()
        closeExportModal()
      }
      return
    }

    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    if (isUndoShortcut(event)) {
      event.preventDefault()
      resetGSequence()
      treeStore.undo()
      return
    }

    if (isRedoShortcut(event)) {
      event.preventDefault()
      resetGSequence()
      treeStore.redo()
      return
    }

    if (isMoveBranchUpShortcut(event)) {
      event.preventDefault()
      resetGSequence()
      treeStore.moveBranchUp()
      return
    }

    if (isMoveBranchDownShortcut(event)) {
      event.preventDefault()
      resetGSequence()
      treeStore.moveBranchDown()
      return
    }

    if (!state.isEditing && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (isKeyG && !isUpperG) {
        event.preventDefault()
        if (gSequenceArmed) {
          resetGSequence()
          treeStore.moveTop()
        } else {
          armGSequence()
        }
        return
      }

      if (isUpperG) {
        event.preventDefault()
        resetGSequence()
        treeStore.moveBottom()
        return
      }
    }

    resetGSequence()

    if (isKeyI) {
      if (!state.isEditing && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        treeStore.startEdit()
      }
      return
    }

    if (key === 'Escape') {
      if (state.isEditing) {
        event.preventDefault()
        treeStore.confirmEdit()
      }
      return
    }

    if (isMoveUpKey) {
      if (state.isEditing) {
        return
      }
      event.preventDefault()
      treeStore.moveUp()
      return
    }

    if (isMoveDownKey) {
      if (state.isEditing) {
        return
      }
      event.preventDefault()
      treeStore.moveDown()
      return
    }

    if (key === 'Enter') {
      if (state.isEditing) {
        return
      }
      event.preventDefault()
      treeStore.insertBelow()
      return
    }

    if (key === 'Tab') {
      if (state.isEditing) {
        return
      }
      event.preventDefault()
      if (event.shiftKey) {
        treeStore.outdentLeft()
      } else {
        treeStore.indentRight()
      }
      return
    }

    if (key === 'Delete' || key === 'Backspace') {
      if (state.isEditing) {
        return
      }
      event.preventDefault()
      treeStore.deleteNode()
      return
    }

    if (key === ' ') {
      if (state.isEditing) {
        return
      }
      event.preventDefault()
      treeStore.indentRight()
      return
    }

    if (state.isEditing && isPrintableCharacter(event)) {
      return
    }
  }

  function handleEditInput(event) {
    treeStore.setEditBuffer(event.currentTarget.value)
  }

  function handleEditKeydown(event) {
    if (isUndoShortcut(event)) {
      event.preventDefault()
      event.stopPropagation()
      resetGSequence()
      treeStore.undo()
      return
    }

    if (isRedoShortcut(event)) {
      event.preventDefault()
      event.stopPropagation()
      resetGSequence()
      treeStore.redo()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      treeStore.confirmEdit()
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      treeStore.confirmEdit()
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      if (event.shiftKey) {
        treeStore.outdentLeft()
      } else {
        treeStore.indentRight()
      }
    }
  }

  function handleEditBlur() {
    treeStore.confirmEdit()
  }

  function selectNode(nodeId) {
    treeStore.selectCursor(nodeId)
  }

  function handleTreeRowKeydown(event, nodeId) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectNode(nodeId)
    }
  }

  function openExportModal() {
    exportText = treeStore.exportAscii()
    copyMessage = ''
    exportOpen = true
  }

  function closeExportModal() {
    copyMessage = ''
    exportOpen = false
  }

  function handleModalBackdropClick(event) {
    if (event.target === event.currentTarget) {
      closeExportModal()
    }
  }

  function handleModalBackdropKeydown(event) {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      closeExportModal()
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
      copyMessage = 'Copied to clipboard'
    } catch (error) {
      copyMessage = 'Copy failed'
    }
  }
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<main class="app">
  <header class="toolbar">
    <div>
      <h1>GitBranchTree</h1>
      <p>Keyboard-first Git branch tree editor</p>
    </div>
    <div class="toolbar-actions">
      <span class="mode-chip" aria-live="polite">{state.isEditing ? 'INPUT' : 'FOCUS'}</span>
      <button class="theme-button" onclick={toggleTheme} aria-label="Toggle theme">
        {#if theme === 'dark'}
          <FontAwesomeIcon icon={byPrefixAndName.fas['moon']} />
        {:else}
          <FontAwesomeIcon icon={byPrefixAndName.fas['sun']} />
        {/if}
      </button>
      <button class="export-button" onclick={openExportModal}>Export</button>
    </div>
  </header>

  <section class="tree-panel" aria-label="Branch tree">
    {#each rowsFromState(state) as row (row.id)}
      <div
        class:selected={state.cursorId === row.id}
        class="tree-row"
        role="button"
        tabindex="0"
        onclick={() => selectNode(row.id)}
        onkeydown={(event) => handleTreeRowKeydown(event, row.id)}
      >
        <span class="cursor-indicator">{state.cursorId === row.id ? '>' : ' '}</span>
        <span class="tree-branch">{branchPrefix(row)}</span>
        {#if state.isEditing && state.cursorId === row.id}
          <input
            id={`node-input-${row.id}`}
            class="node-input"
            value={state.editBuffer}
            spellcheck="false"
            autocomplete="off"
            oninput={handleEditInput}
            onkeydown={handleEditKeydown}
            onblur={handleEditBlur}
          />
        {:else}
          <span class="node-name">{row.node.name}</span>
        {/if}
      </div>
    {/each}
  </section>

  {#if exportOpen}
    <div
      class="modal-backdrop"
      role="button"
      tabindex="0"
      onclick={handleModalBackdropClick}
      onkeydown={handleModalBackdropKeydown}
    >
      <div class="modal" role="dialog" aria-modal="true" aria-label="Export ASCII tree">
        <h2>ASCII Export</h2>
        <textarea readonly value={exportText}></textarea>
        <div class="modal-actions">
          <button onclick={copyExportText}>Copy</button>
          <button class="ghost" onclick={closeExportModal}>Close</button>
        </div>
        {#if copyMessage}
          <p class="copy-status">{copyMessage}</p>
        {/if}
      </div>
    </div>
  {/if}
</main>
