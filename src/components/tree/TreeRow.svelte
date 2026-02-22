<script>
  import { createEventDispatcher } from 'svelte'
  import { shouldActivateRowFromKeydown } from '../../features/keyboard/rowInteraction'

  export let row
  export let state
  export let branchPrefix

  const dispatch = createEventDispatcher()

  function stopEventPropagation(event) {
    event.stopPropagation()
  }

  function selectNode() {
    dispatch('select', { nodeId: row.id })
  }

  function handleRowKeydown(event) {
    if (!shouldActivateRowFromKeydown(event.key, event.target === event.currentTarget)) {
      return
    }
    event.preventDefault()
    selectNode()
  }

  function handleNamePointerUp(event) {
    dispatch('nameTap', {
      nodeId: row.id,
      timeStamp: event.timeStamp,
    })
  }

  function handleNameInput(event) {
    dispatch('nameInput', { value: event.currentTarget.value })
  }

  function handleCommentInput(event) {
    dispatch('commentInput', { value: event.currentTarget.value })
  }
</script>

<div
  class:selected={state.cursorId === row.id}
  class="tree-row"
  role="button"
  tabindex="0"
  onclick={selectNode}
  onkeydown={handleRowKeydown}
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
        onkeydown={(event) => dispatch('nameKeydown', event)}
        onblur={() => dispatch('nameBlur')}
        onclick={stopEventPropagation}
      />
    {:else}
      <button type="button" tabindex="-1" class="node-name node-name-button" onpointerup={handleNamePointerUp}>{row.node.name}</button>
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
          onkeydown={(event) => dispatch('commentKeydown', event)}
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
