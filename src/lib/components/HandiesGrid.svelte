<script lang="ts">
  import type { Handy } from '$lib/services/db.service.svelte';
  import SearchInput from './SearchInput.svelte';
  import HandySection from './HandySection.svelte';

  let {
    filteredHandies,
    filterInput = $bindable(''),
    onassign,
    onpin,
    oncontextmenu,
  }: {
    filteredHandies: Handy[];
    filterInput: string;
    onassign: (id: number) => void;
    onpin: (id: number) => void;
    oncontextmenu: (e: MouseEvent, handy: Handy) => void;
  } = $props();
</script>

<main class="workspace">
  <section class="grid-section">
    <div class="grid-header">
      <SearchInput
        class="page-search"
        id="handies-filter"
        navZone="search"
        bind:value={filterInput}
        placeholder="Filtrar por nombre o área..."
      />
    </div>

    <HandySection
      title="Lista de Handies"
      handies={filteredHandies}
      {onassign}
      {onpin}
      {oncontextmenu}
    />

    {#if filteredHandies.length === 0}
      <div class="empty-state animate-fade">
        <p>No hay handies que coincidan con el filtro</p>
      </div>
    {/if}
  </section>
</main>

<style>
  .workspace {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-right: 10px;
    padding-bottom: 12px;
  }

  .grid-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .grid-header {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-bottom: 8px;
    flex-shrink: 0;
    padding-bottom: 10px;
    background: linear-gradient(
      to bottom,
      var(--bg-main) 0%,
      var(--header-fade) 70%,
      transparent 100%
    );
  }

  :global(.page-search) {
    flex-shrink: 0;
    width: 260px;
  }

  .empty-state {
    padding: 40px 20px;
    text-align: center;
    border: 1px dashed var(--border-2);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  @media (max-width: 1024px) {
    :global(.page-search) {
      width: 200px;
    }
  }

  @media (max-width: 768px) {
    .grid-header {
      justify-content: stretch;
    }

    :global(.page-search) {
      flex: 1;
      width: 100%;
    }
  }
</style>
