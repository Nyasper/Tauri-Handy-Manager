<script lang="ts">
  import { handyDB, historyToCsv } from '$lib/services/db.service.svelte';
  import { save } from '@tauri-apps/plugin-dialog';
  import { invoke } from '@tauri-apps/api/core';
  import AppModal from './AppModal.svelte';
  import SearchInput from './SearchInput.svelte';
  import HistorialDeleteModal from './HistorialDeleteModal.svelte';
  import Alert from './Alert.svelte';

  let { onclose }: { onclose: () => void } = $props();

  let searchInput = $state('');
  let actionFilter = $state<'all' | 'assign' | 'unassign'>('all');
  let showDeleteModal = $state(false);
  let exporting = $state(false);
  let exportError = $state<string | null>(null);
  let exportSuccess = $state<string | null>(null);

  const filteredHistory = $derived(
    (() => {
      const term = searchInput.trim().toLowerCase();
      return handyDB.history.filter((entry) => {
        if (actionFilter !== 'all' && entry.action !== actionFilter) return false;
        if (!term) return true;
        return (
          entry.owner_name.toLowerCase().includes(term) ||
          String(entry.handy_id).includes(term)
        );
      });
    })(),
  );

  const assignCount = $derived(
    handyDB.history.filter((e) => e.action === 'assign').length,
  );
  const unassignCount = $derived(
    handyDB.history.filter((e) => e.action === 'unassign').length,
  );

  function formatDate(timestamp: string): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;
    return date.toLocaleString('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function toggleFilter(filter: 'assign' | 'unassign') {
    actionFilter = actionFilter === filter ? 'all' : filter;
  }

  async function exportCsv() {
    exportError = null;
    exportSuccess = null;
    if (filteredHistory.length === 0) {
      exportError = 'No hay eventos que exportar';
      return;
    }
    let path: string | null;
    try {
      path = await save({
        title: 'Exportar historial',
        defaultPath: 'historial.csv',
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
    } catch (err: any) {
      exportError = err.message || 'Error al elegir el archivo de exportación';
      return;
    }
    if (!path) return;
    exporting = true;
    try {
      const csv = historyToCsv(filteredHistory);
      await invoke('write_text_file', { path, contents: csv });
      exportSuccess = `Historial exportado (${filteredHistory.length} evento${filteredHistory.length === 1 ? '' : 's'})`;
    } catch (err: any) {
      exportError = err.message || 'Error al exportar el historial';
    } finally {
      exporting = false;
    }
  }
</script>

<AppModal title="Historial" maxWidth="680px" {onclose}>
  <div class="modal-body">
    <div class="history-toolbar">
      <SearchInput
        id="history-search"
        bind:value={searchInput}
        placeholder="Buscar por funcionario o # de handy..."
      />
      <div class="history-stats">
        <button
          type="button"
          class="stat-chip"
          class:active={actionFilter === 'assign'}
          onclick={() => toggleFilter('assign')}
          title={actionFilter === 'assign' ? 'Mostrar todos' : 'Filtrar vinculados'}
        >
          Vinculados <span>{assignCount}</span>
        </button>
        <button
          type="button"
          class="stat-chip danger"
          class:active={actionFilter === 'unassign'}
          onclick={() => toggleFilter('unassign')}
          title={actionFilter === 'unassign' ? 'Mostrar todos' : 'Filtrar desvinculados'}
        >
          Desvinculados <span>{unassignCount}</span>
        </button>
        <button
          type="button"
          class="export-btn"
          onclick={exportCsv}
          disabled={exporting}
          title="Exportar historial a CSV"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          {exporting ? 'Exportando...' : 'Exportar'}
        </button>
        <button
          type="button"
          class="delete-btn"
          onclick={() => (showDeleteModal = true)}
          title="Eliminar historial"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
            <path d="M10 11v6"></path>
            <path d="M14 11v6"></path>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
          </svg>
          Eliminar
        </button>
      </div>
    </div>

    <div class="history-list">
      {#each filteredHistory as entry (entry.id)}
        <div class="history-item" class:is-unassign={entry.action === 'unassign'}>
          <span class="handy-badge-sm">Handy #{entry.handy_id}</span>
          <div class="history-main">
            <span class="history-action">
              {#if entry.action === 'assign'}
                Se vinculó a <strong>{entry.owner_name}</strong>
              {:else}
                Se desvinculó de <strong>{entry.owner_name}</strong>
              {/if}
            </span>
            <span class="history-date">{formatDate(entry.timestamp)}</span>
          </div>
        </div>
      {/each}

      {#if filteredHistory.length === 0}
        <div class="history-empty">
          <p>No hay eventos que coincidan con el filtro</p>
        </div>
      {/if}
    </div>

    {#if exportError}
      <Alert type="danger" icon={false} class="modal-alert">{exportError}</Alert>
    {/if}
    {#if exportSuccess}
      <Alert type="success" icon={false} class="modal-alert">{exportSuccess}</Alert>
    {/if}
  </div>
</AppModal>

{#if showDeleteModal}
  <HistorialDeleteModal onclose={() => (showDeleteModal = false)} />
{/if}

<style>
  .modal-body {
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .history-toolbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin: -20px -24px 0;
    padding: 20px 24px 16px;
    background: linear-gradient(
      to bottom,
      rgba(13, 14, 18, 0.97) 0%,
      rgba(13, 14, 18, 0.97) 72%,
      rgba(13, 14, 18, 0) 100%
    );
  }

  .history-toolbar :global(.search-group) {
    flex: 1;
    min-width: 200px;
  }

  .history-stats {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .stat-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--text-secondary);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .stat-chip span {
    font-weight: 700;
    font-family: var(--font-header);
    color: var(--color-accent);
  }

  .stat-chip.danger span {
    color: var(--color-danger);
  }

  .stat-chip.active {
    background: rgba(255, 255, 255, 0.12);
    border-color: var(--color-accent-border);
    color: #fff;
  }

  .stat-chip.danger.active {
    border-color: rgba(244, 63, 94, 0.5);
    background: rgba(244, 63, 94, 0.12);
  }

  .export-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(16, 185, 129, 0.05);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: var(--color-success);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .export-btn svg {
    width: 14px;
    height: 14px;
  }

  .export-btn:hover:not(:disabled) {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.5);
  }

  .export-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .delete-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(244, 63, 94, 0.05);
    border: 1px solid rgba(244, 63, 94, 0.2);
    color: var(--color-danger);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .delete-btn svg {
    width: 14px;
    height: 14px;
  }

  .delete-btn:hover {
    background: rgba(244, 63, 94, 0.15);
    border-color: rgba(244, 63, 94, 0.5);
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .history-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-sm);
  }

  .history-item.is-unassign {
    background: rgba(244, 63, 94, 0.03);
    border-color: rgba(244, 63, 94, 0.08);
  }

  .handy-badge-sm {
    flex-shrink: 0;
    padding: 4px 10px;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: var(--color-success);
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .history-item.is-unassign .handy-badge-sm {
    background: rgba(244, 63, 94, 0.08);
    border-color: rgba(244, 63, 94, 0.2);
    color: var(--color-danger);
  }

  .history-main {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .history-action {
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .history-action strong {
    font-weight: 600;
  }

  .history-item.is-unassign .history-action {
    color: #fda4af;
  }

  .history-date {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .history-empty {
    padding: 40px 20px;
    text-align: center;
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  :global(.modal-alert) {
    margin: 0;
  }

  @media (max-width: 480px) {
    .modal-body {
      padding: 14px 16px;
    }

    .history-toolbar {
      flex-direction: column;
      align-items: stretch;
      margin: -14px -16px 0;
      padding: 14px 16px 16px;
    }

    .history-stats {
      flex-wrap: wrap;
      justify-content: center;
    }

    .stat-chip,
    .export-btn,
    .delete-btn {
      flex: 1;
      justify-content: center;
      white-space: nowrap;
    }

    .history-item {
      align-items: flex-start;
    }
  }
</style>
