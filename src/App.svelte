<script>
  import { get } from 'svelte/store'
  import { onDestroy, tick } from 'svelte'
  import { treeStore } from './lib/treeStore'
  import { buildAsciiRowsWithComments, computeVisibleRows } from './lib/treeUtils'
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
  let helpOpen = false
  let exportText = ''
  let copyMessage = ''
  let focusRequestId = 0
  let theme = getInitialTheme()
  let gSequenceArmed = false
  let gSequenceTimer = null

  $: applyTheme(theme)

  const unsubscribe = treeStore.subscribe((nextState) => {
    state = nextState
    if (state.mode === 'name' || state.mode === 'comment') {
      focusCurrentEditor(state.cursorId, state.mode)
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

  async function focusCurrentEditor(nodeId, mode) {
    const requestId = ++focusRequestId
    await tick()

    if (requestId !== focusRequestId) {
      return
    }

    
    const inputId = mode === 'comment' ? `node-comment-input-${nodeId}` : `node-name-input-${nodeId}`
    const input = document.getElementById(inputId)
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

  function stopEventPropagation(event) {
    event.stopPropagation()
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

  function isMoveUpKey(key, code) {
    return (
      key === 'ArrowUp' ||
      code === 'KeyK' ||
      code === 'KeyL' ||
      key === 'k' ||
      key === 'K' ||
      key === 'l' ||
      key === 'L'
    )
  }

  function isMoveDownKey(key, code) {
    return (
      key === 'ArrowDown' ||
      code === 'KeyH' ||
      code === 'KeyJ' ||
      key === 'h' ||
      key === 'H' ||
      key === 'j' ||
      key === 'J'
    )
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

  function handleGlobalKeydown(event) {
    const key = event.key
    const code = event.code
    const isKeyI = code === 'KeyI' || key === 'i' || key === 'I'
    const isKeyC = code === 'KeyC' || key === 'c' || key === 'C'
    const isKeyG = code === 'KeyG' || key === 'g' || key === 'G'
    const isUpperG = key === 'G' || (code === 'KeyG' && event.shiftKey)
    const moveUpKey = isMoveUpKey(key, code)
    const moveDownKey = isMoveDownKey(key, code)

    if (exportOpen) {
      if (key === 'Escape') {
        event.preventDefault()
        closeExportModal()
      }
      return
    }

    if (helpOpen) {
      if (key === 'Escape') {
        event.preventDefault()
        closeHelpModal()
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

    if (state.mode === 'comment') {
      resetGSequence()

      if (key === 'Escape') {
        event.preventDefault()
        treeStore.confirmCommentEdit()
        return
      }

      if (key === 'Enter') {
        event.preventDefault()
        treeStore.confirmCommentEdit()
        return
      }

      if (key === 'Tab') {
        event.preventDefault()
        return
      }

      return
    }

    if (state.mode === 'focus' && isMoveBranchUpShortcut(event)) {
      event.preventDefault()
      resetGSequence()
      treeStore.moveBranchUp()
      return
    }

    if (state.mode === 'focus' && isMoveBranchDownShortcut(event)) {
      event.preventDefault()
      resetGSequence()
      treeStore.moveBranchDown()
      return
    }

    if (state.mode === 'focus' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (key === '?') {
        event.preventDefault()
        resetGSequence()
        openHelpModal()
        return
      }

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
      if (state.mode === 'focus' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        treeStore.startEdit()
      }
      return
    }

    if (isKeyC) {
      if (state.mode === 'focus' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        treeStore.startCommentEdit()
      }
      return
    }

    if (key === 'Escape') {
      if (state.mode === 'name') {
        event.preventDefault()
        treeStore.confirmEdit()
      }
      return
    }

    if (moveUpKey) {
      if (state.mode !== 'focus') {
        return
      }
      event.preventDefault()
      treeStore.moveUp()
      return
    }

    if (moveDownKey) {
      if (state.mode !== 'focus') {
        return
      }
      event.preventDefault()
      treeStore.moveDown()
      return
    }

    if (key === 'Enter') {
      if (state.mode !== 'focus') {
        return
      }
      event.preventDefault()
      treeStore.insertChildTop()
      return
    }

    if (key === 'Tab') {
      if (state.mode !== 'focus') {
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
      if (state.mode !== 'focus') {
        return
      }
      event.preventDefault()
      treeStore.deleteNode()
      return
    }

    if (key === ' ') {
      if (state.mode !== 'focus') {
        return
      }
      event.preventDefault()
      treeStore.indentRight()
    }
  }

  function handleNameInput(event) {
    treeStore.setEditBuffer(event.currentTarget.value)
  }

  function handleNameKeydown(event) {
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

  function handleNameBlur() {
    treeStore.confirmEdit()
  }

  function handleCommentInput(event) {
    treeStore.setCommentBuffer(event.currentTarget.value)
  }

  function handleCommentKeydown(event) {
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
      treeStore.confirmCommentEdit()
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      treeStore.confirmCommentEdit()
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      return
    }

  }

  function selectNode(nodeId) {
    ensureNameSaved()
    ensureCommentSaved()
    treeStore.selectCursor(nodeId)
  }

  function handleTreeRowKeydown(event, nodeId) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectNode(nodeId)
    }
  }

  function openExportModal() {
    ensureNameSaved()
    ensureCommentSaved()
    helpOpen = false
    exportText = treeStore.exportAscii()
    copyMessage = ''
    exportOpen = true
  }

  function closeExportModal() {
    copyMessage = ''
    exportOpen = false
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

  function handleHelpBackdropClick(event) {
    if (event.target === event.currentTarget) {
      closeHelpModal()
    }
  }

  function handleHelpBackdropKeydown(event) {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      closeHelpModal()
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
      <p>Keyboard-first Git branch tree editor</p>
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
        <div class="tree-left">
          <span class="cursor-indicator">{state.cursorId === row.id ? '>' : ' '}</span>
          <span class="tree-branch">{branchPrefix(row)}</span>
          {#if state.mode === 'name' && state.cursorId === row.id}
            <input
              id={`node-name-input-${row.id}`}
              class="node-input"
              value={state.nameBuffer}
              spellcheck="false"
              autocomplete="off"
              oninput={handleNameInput}
              onkeydown={handleNameKeydown}
              onblur={handleNameBlur}
              onclick={stopEventPropagation}
            />
          {:else}
            <span class="node-name">{row.node.name}</span>
          {/if}
        </div>
        <div class="tree-comment" style={`padding-left: ${row.commentPadding}ch;`}>
          {#if state.mode === 'comment' && state.cursorId === row.id}
            <div class="comment-editor">
              <span class="comment-prefix"># </span>
              <input
                id={`node-comment-input-${row.id}`}
                class="comment-input"
                value={state.commentBuffer}
                spellcheck="false"
                autocomplete="off"
                oninput={handleCommentInput}
                onkeydown={handleCommentKeydown}
                onclick={stopEventPropagation}
              />
            </div>
          {:else if row.node.comment.length > 0}
            <div class="comment-display">
              <span class="comment-prefix"># </span>
              <span class="comment-text">{row.node.comment}</span>
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </section>

  {#if helpOpen}
    <div
      class="modal-backdrop"
      role="button"
      tabindex="0"
      onclick={handleHelpBackdropClick}
      onkeydown={handleHelpBackdropKeydown}
    >
      <div class="modal" role="dialog" aria-modal="true" aria-label="Keyboard help">
        <h2>Keyboard Help</h2>
        <div class="help-body">
          <p><strong>FOCUS</strong></p>
          <p><code>↑ / ↓</code>: カーソル移動</p>
          <p><code>h / j</code>: 下へ移動</p>
          <p><code>k / l</code>: 上へ移動</p>
          <p><code>Enter</code>: 先頭子ノードを追加</p>
          <p><code>Tab</code>: 右インデント</p>
          <p><code>Shift + Tab</code>: 左アウトデント</p>
          <p><code>i</code>: INPUTモード</p>
          <p><code>c</code>: COMMENTモード</p>
          <p><code>?</code>: このヘルプを開く</p>
          <p><code>Esc</code>: ヘルプを閉じる</p>
          <p><strong>INPUT</strong></p>
          <p>通常入力 / <code>Enter</code> or <code>Esc</code> で確定</p>
          <p><strong>COMMENT</strong></p>
          <p>通常入力（<code>hjkl</code> は移動しない）</p>
          <p><code>Enter</code> or <code>Esc</code> で確定してFOCUSへ</p>
        </div>
        <div class="modal-actions">
          <button class="ghost" onclick={closeHelpModal}>Close</button>
        </div>
      </div>
    </div>
  {/if}

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
