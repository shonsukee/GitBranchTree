<script>
  import { get } from 'svelte/store'
  import { onDestroy, tick } from 'svelte'
  import { treeStore } from './lib/treeStore'
  import { computeVisibleRows } from './lib/treeUtils'
  import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome'
  import { faMoon } from '@fortawesome/free-solid-svg-icons'

  const THEME_STORAGE_KEY = 'gitbranchtree.theme.v1'

  let state = get(treeStore)
  let exportOpen = false
  let exportText = ''
  let copyMessage = ''
  let focusRequestId = 0
  let theme = getInitialTheme()

  $: applyTheme(theme)

  const unsubscribe = treeStore.subscribe((nextState) => {
    state = nextState
    if (state.isEditing) {
      focusCurrentEditor(state.cursorId)
    }
  })

  onDestroy(() => {
    unsubscribe()
  })

  function getInitialTheme() {
    if (typeof window === 'undefined') {
      return 'light'
    }

    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme
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
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    }
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
    if (exportOpen) {
      if (event.key === 'Escape') {
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
      treeStore.undo()
      return
    }

    if (isRedoShortcut(event)) {
      event.preventDefault()
      treeStore.redo()
      return
    }

    if (isMoveBranchUpShortcut(event)) {
      event.preventDefault()
      treeStore.moveBranchUp()
      return
    }

    if (isMoveBranchDownShortcut(event)) {
      event.preventDefault()
      treeStore.moveBranchDown()
      return
    }

    if (state.isEditing) {
      return
    }

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        treeStore.moveUp()
        return
      case 'ArrowDown':
        event.preventDefault()
        treeStore.moveDown()
        return
      case 'Enter':
        event.preventDefault()
        treeStore.insertBelow()
        return
      case 'Tab':
        event.preventDefault()
        if (event.shiftKey) {
          treeStore.outdentLeft()
        } else {
          treeStore.indentRight()
        }
        return
      case 'Delete':
      case 'Backspace':
        event.preventDefault()
        treeStore.deleteNode()
        return
      case ' ':
        event.preventDefault()
        treeStore.indentRight()
        return
      default:
        break
    }

    if (!isPrintableCharacter(event)) {
      return
    }

    event.preventDefault()
    treeStore.startEdit()
    treeStore.applyTypedChar(event.key)
  }

  function handleEditInput(event) {
    treeStore.setEditBuffer(event.currentTarget.value)
  }

  function handleEditKeydown(event) {
    if (isUndoShortcut(event)) {
      event.preventDefault()
      event.stopPropagation()
      treeStore.undo()
      return
    }

    if (isRedoShortcut(event)) {
      event.preventDefault()
      event.stopPropagation()
      treeStore.redo()
      return
    }

    switch (event.key) {
      case 'Enter':
        event.preventDefault()
        event.stopPropagation()
        treeStore.confirmEdit()
        treeStore.insertBelow()
        break
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        treeStore.cancelEdit()
        break
      case 'Tab':
        event.preventDefault()
        event.stopPropagation()
        if (event.shiftKey) {
          treeStore.outdentLeft()
        } else {
          treeStore.indentRight()
        }
        break
      case ' ':
        event.preventDefault()
        event.stopPropagation()
        treeStore.indentRight()
        break
      default:
        break
    }
  }

  function handleEditBlur() {
    treeStore.confirmEdit()
  }

  function selectNode(nodeId) {
    treeStore.selectCursor(nodeId)
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
      <button className="theme-button" onClick={toggleTheme}>
        <FontAwesomeIcon icon={faMoon} />
        <!-- {theme === "light" ?
         : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
            {/* Font Awesome Free v7.2.0 */}
            <path d="M320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576C388.8 576 451.3 548.8 497.3 504.6C504.6 497.6 506.7 486.7 502.6 477.5C498.5 468.3 488.9 462.6 478.8 463.4C473.9 463.8 469 464 464 464C362.4 464 280 381.6 280 280C280 207.9 321.5 145.4 382.1 115.2C391.2 110.7 396.4 100.9 395.2 90.8C394 80.7 386.6 72.5 376.7 70.3C358.4 66.2 339.4 64 320 64z" />
          </svg>
        )} -->
      </button>
      <button class="export-button" onclick={openExportModal}>Export</button>
    </div>
  </header>

  <section class="tree-panel" aria-label="Branch tree">
    {#each rowsFromState(state) as row (row.id)}
      <div
        class:selected={state.cursorId === row.id}
        class="tree-row"
        onclick={() => selectNode(row.id)}
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
    <div class="modal-backdrop" onclick={closeExportModal}>
      <section
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Export ASCII tree"
        onclick={(event) => event.stopPropagation()}
      >
        <h2>ASCII Export</h2>
        <textarea readonly value={exportText}></textarea>
        <div class="modal-actions">
          <button onclick={copyExportText}>Copy</button>
          <button class="ghost" onclick={closeExportModal}>Close</button>
        </div>
        {#if copyMessage}
          <p class="copy-status">{copyMessage}</p>
        {/if}
      </section>
    </div>
  {/if}
</main>
