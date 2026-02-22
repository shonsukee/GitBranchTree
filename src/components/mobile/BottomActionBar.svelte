<script>
  import { createEventDispatcher } from 'svelte'
  import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome'
  import {
    faArrowUpRightFromSquare,
    faCircleInfo,
    faCommentDots,
    faDownLong,
    faIndent,
    faOutdent,
    faPen,
    faPlus,
    faUpLong,
  } from '@fortawesome/free-solid-svg-icons'

  export let hidden = false
  export let mode = 'focus'

  const dispatch = createEventDispatcher()
  const focusOnlyActions = new Set(['add-child', 'indent', 'outdent'])
  const byPrefixAndName = {
    fas: {
      indent: faIndent,
      outdent: faOutdent,
      'up-long': faUpLong,
      'down-long': faDownLong,
      plus: faPlus,
      'comment-dots': faCommentDots,
      pen: faPen,
      'arrow-up-right-from-square': faArrowUpRightFromSquare,
      'circle-info': faCircleInfo,
    },
  }

  function isDisabled(action) {
    if (focusOnlyActions.has(action)) {
      return mode !== 'focus'
    }
    if ((action === 'up' || action === 'down') && mode === 'name') {
      return true
    }
    return false
  }

  function triggerAction(action) {
    if (isDisabled(action)) {
      return
    }
    dispatch('action', { action })
  }

  let pointerTriggeredAction = null

  function handleActionPointerDown(event, action) {
    // Fire before input blur/click ordering so mode toggles are consistent on mobile.
    event.preventDefault()
    pointerTriggeredAction = action
    triggerAction(action)
  }

  function handleActionClick(action) {
    if (pointerTriggeredAction === action) {
      pointerTriggeredAction = null
      return
    }
    triggerAction(action)
  }
</script>

{#if !hidden}
  <nav class="bottom-action-bar" aria-label="Mobile actions">
    <div class="action-group" role="group" aria-label="Tree move">
      <button
        class="action-button"
        type="button"
        aria-label="Move up"
        title="Move up"
        onpointerdown={(event) => handleActionPointerDown(event, 'up')}
        onclick={() => handleActionClick('up')}
        disabled={isDisabled('up')}
      >
        <FontAwesomeIcon icon={byPrefixAndName.fas['up-long']} />
      </button>
      <button
        class="action-button"
        type="button"
        aria-label="Move down"
        title="Move down"
        onpointerdown={(event) => handleActionPointerDown(event, 'down')}
        onclick={() => handleActionClick('down')}
        disabled={isDisabled('down')}
      >
        <FontAwesomeIcon icon={byPrefixAndName.fas['down-long']} />
      </button>
      <button
        class="action-button"
        type="button"
        aria-label="Add child"
        title="Add child"
        onpointerdown={(event) => handleActionPointerDown(event, 'add-child')}
        onclick={() => handleActionClick('add-child')}
        disabled={isDisabled('add-child')}
      >
        <FontAwesomeIcon icon={byPrefixAndName.fas['plus']} />
      </button>
      <button
        class="action-button"
        type="button"
        aria-label="Indent"
        title="Indent"
        onpointerdown={(event) => handleActionPointerDown(event, 'indent')}
        onclick={() => handleActionClick('indent')}
        disabled={isDisabled('indent')}
      >
        <FontAwesomeIcon icon={byPrefixAndName.fas['indent']} />
      </button>
      <button
        class="action-button"
        type="button"
        aria-label="Outdent"
        title="Outdent"
        onpointerdown={(event) => handleActionPointerDown(event, 'outdent')}
        onclick={() => handleActionClick('outdent')}
        disabled={isDisabled('outdent')}
      >
        <FontAwesomeIcon icon={byPrefixAndName.fas['outdent']} />
      </button>
    </div>

    <div class="action-group" role="group" aria-label="Modes and tools">
      <button
        class="action-button"
        type="button"
        aria-label="Input mode"
        title="Input mode"
        onpointerdown={(event) => handleActionPointerDown(event, 'input')}
        onclick={() => handleActionClick('input')}
      >
        <FontAwesomeIcon icon={byPrefixAndName.fas['pen']} />
      </button>
      <button
        class="action-button"
        type="button"
        aria-label="Comment mode"
        title="Comment mode"
        onpointerdown={(event) => handleActionPointerDown(event, 'comment')}
        onclick={() => handleActionClick('comment')}
      >
        <FontAwesomeIcon icon={byPrefixAndName.fas['comment-dots']} />
      </button>
      <button
        class="action-button"
        type="button"
        aria-label="Help"
        title="Help"
        onpointerdown={(event) => handleActionPointerDown(event, 'help')}
        onclick={() => handleActionClick('help')}
      >
        <FontAwesomeIcon icon={byPrefixAndName.fas['circle-info']} />
      </button>
      <button
        class="action-button action-button-accent"
        type="button"
        aria-label="Export"
        title="Export"
        onpointerdown={(event) => handleActionPointerDown(event, 'export')}
        onclick={() => handleActionClick('export')}
      >
        <FontAwesomeIcon icon={byPrefixAndName.fas['arrow-up-right-from-square']} />
      </button>
    </div>
  </nav>
{/if}
