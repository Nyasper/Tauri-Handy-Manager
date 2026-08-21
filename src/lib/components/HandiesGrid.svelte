<script lang="ts">
  import type { Handy } from '$lib/services/db.service.svelte';
  import { shortcuts } from '$lib/services/shortcuts.service.svelte';
  import SearchInput from './SearchInput.svelte';
  import HandySection from './HandySection.svelte';

  let {
    filteredHandies,
    hasActiveFilter = false,
    filterInput = $bindable(''),
    onclear,
    onassign,
    onpin,
    oncontextmenu,
  }: {
    filteredHandies: Handy[];
    hasActiveFilter?: boolean;
    filterInput: string;
    onclear: () => void;
    onassign: (id: number) => void;
    onpin: (id: number) => void;
    oncontextmenu: (e: MouseEvent, handy: Handy) => void;
  } = $props();
</script>

<main class="workspace">
  <section class="grid-section">
    <div class="grid-header">
      {#if hasActiveFilter}
        <button
          type="button"
          class="clear-filter-btn"
          {@attach shortcuts.rovingFocus('search')}
          onclick={onclear}
          aria-label="Mostrar todos los handies"
          title="Quitar filtros y mostrar todos"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m15 18-6-6 6-6"></path>
          </svg>
          Todos
        </button>
      {/if}
      <SearchInput
        class="page-search"
        id="handies-filter"
        navZone="search"
        bind:value={filterInput}
        placeholder="Filtrar por nombre o área..."
      />
    </div>

    <HandySection
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
    padding-left: 10px;
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

  .clear-filter-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 8px 14px;
    margin-right: 12px;
    border-radius: 999px;
    background: var(--surface-1);
    border: 1px solid var(--border-1);
    color: var(--text-secondary);
    font-family: var(--font-header);
    font-weight: 600;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }

  .clear-filter-btn svg {
    width: 15px;
    height: 15px;
  }

  .clear-filter-btn:hover {
    background: var(--surface-hover);
    border-color: var(--border-2);
    color: var(--text-primary);
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
