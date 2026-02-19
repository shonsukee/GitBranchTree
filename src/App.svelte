<script>
  import { get } from 'svelte/store'
  import { onDestroy, tick } from 'svelte'
  import { treeStore } from './lib/treeStore'
  import { EMPTY_LABEL, computeVisibleList, getDepth } from './lib/treeUtils'

  let state = get(treeStore)
  let exportOpen = false
  let exportText = ''
  let copyMessage = ''
  let focusRequestId = 0

  const unsubscribe = treeStore.subscribe((nextState) => {
    state = nextState
    if (state.isEditing) {
      focusCurrentEditor(state.cursorId)
    }
  })

  onDestroy(() => {
    unsubscribe()
  })

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

    const visibleIds = computeVisibleList(editorState.doc)
    return visibleIds.map((id) => ({
      id,
      node: editorState.doc.nodes[id],
      depth: getDepth(editorState.doc, id),
    }))
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
        treeStore.clearName()
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
    <button class="export-button" onclick={openExportModal}>Export</button>
  </header>

  <section class="tree-panel" aria-label="Branch tree">
    {#each rowsFromState(state) as row (row.id)}
      <div
        class:selected={state.cursorId === row.id}
        class="tree-row"
        style={`--depth: ${row.depth};`}
        onclick={() => selectNode(row.id)}
      >
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
          <span class:empty={row.node.name === ''} class="node-name">
            {row.node.name === '' ? EMPTY_LABEL : row.node.name}
          </span>
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
