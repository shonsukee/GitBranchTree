<script>
  import { createEventDispatcher } from 'svelte'
  import TreeRow from './TreeRow.svelte'

  export let rows = []
  export let state
  export let branchPrefix

  const dispatch = createEventDispatcher()

  function relay(event) {
    dispatch(event.type, event.detail)
  }
</script>

<section class="tree-panel" aria-label="Branch tree">
  {#each rows as row (row.id)}
    <TreeRow
      {row}
      {state}
      {branchPrefix}
      on:select={relay}
      on:nameTap={relay}
      on:nameInput={relay}
      on:nameKeydown={relay}
      on:nameBlur={relay}
      on:commentInput={relay}
      on:commentKeydown={relay}
    />
  {/each}
</section>
