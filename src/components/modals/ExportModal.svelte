<script>
  import { createEventDispatcher } from 'svelte'
  import { EXPORT_FORMAT_ASCII, EXPORT_FORMAT_MERMAID } from '../../features/export/exportFormats'

  export let open = false
  export let format = EXPORT_FORMAT_ASCII
  export let text = ''
  export let copyMessage = ''

  const dispatch = createEventDispatcher()

  function close() {
    dispatch('close')
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      close()
    }
  }

  function handleBackdropKeydown(event) {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      close()
    }
  }
</script>

{#if open}
  <div
    class="modal-backdrop"
    role="button"
    tabindex="0"
    onclick={handleBackdropClick}
    onkeydown={handleBackdropKeydown}
  >
    <div class="modal" role="dialog" aria-modal="true" aria-label="Export">
      <h2>Export</h2>
      <div class="export-format-tabs">
        <button
          class:active={format === EXPORT_FORMAT_ASCII}
          type="button"
          onclick={() => dispatch('changeFormat', { format: EXPORT_FORMAT_ASCII })}
        >
          ASCII
        </button>
        <button
          class:active={format === EXPORT_FORMAT_MERMAID}
          type="button"
          onclick={() => dispatch('changeFormat', { format: EXPORT_FORMAT_MERMAID })}
        >
          Mermaid gitGraph
        </button>
      </div>
      <textarea readonly value={text}></textarea>
      <div class="modal-actions">
        <button onclick={() => dispatch('copy')}>Copy</button>
        <button class="ghost" onclick={close}>Close</button>
      </div>
      {#if copyMessage}
        <p class="copy-status">{copyMessage}</p>
      {/if}
    </div>
  </div>
{/if}
