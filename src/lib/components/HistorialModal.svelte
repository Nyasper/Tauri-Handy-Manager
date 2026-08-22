<script lang="ts">
  import {
    handyDB,
    historyToCsv,
    HISTORY_PAGE_SIZE_DEFAULT,
    type HistoryEntry,
  } from '$lib/services/db.service.svelte';
  import { save } from '@tauri-apps/plugin-dialog';
  import { invoke } from '@tauri-apps/api/core';
  import AppModal from './AppModal.svelte';
  import SearchInput from './SearchInput.svelte';
  import HistorialDeleteModal from './HistorialDeleteModal.svelte';
  import BackupModal from './BackupModal.svelte';
  import Alert from './Alert.svelte';

  let { onclose }: { onclose: () => void } = $props();

  let searchInput = $state('');
  let actionFilter = $state<'all' | 'assign' | 'unassign'>('all');
  let showDeleteModal = $state(false);
  let showBackupModal = $state(false);
  let exporting = $state(false);
  let exportError = $state<string | null>(null);
  let exportSuccess = $state<string | null>(null);

  function clearFeedback() {
    exportError = null;
    exportSuccess = null;
  }

  let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  // Auto-dismiss the toast after 3 seconds
  $effect(() => {
    if (exportError || exportSuccess) {
      if (feedbackTimer) clearTimeout(feedbackTimer);
      feedbackTimer = setTimeout(() => {
        clearFeedback();
        feedbackTimer = null;
      }, 3000);
    }
    return () => {
      if (feedbackTimer) clearTimeout(feedbackTimer);
      feedbackTimer = null;
    };
  });

  // Paginated history loaded from the database (newest first)
  let entries = $state<HistoryEntry[]>([]);
  let total = $state(0);
  let loading = $state(true);
  let loadingMore = $state(false);
  let debouncedSearch = $state('');
  let fromDate = $state('');
  let toDate = $state('');
  // Plain counter (not reactive): guards against stale responses without
  // invalidating the $effect that triggers reloads.
  let queryVersion = 0;

  const hasMore = $derived(entries.length < total);

  function formatDate(timestamp: string): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;
    return date.toLocaleString('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  function toggleFilter(filter: 'assign' | 'unassign') {
    actionFilter = actionFilter === filter ? 'all' : filter;
  }

  async function reload() {
    const version = ++queryVersion;
    loading = true;
    try {
      const result = await handyDB.queryHistory({
        action: actionFilter,
        term: debouncedSearch,
        from: fromDate || undefined,
        to: toDate || undefined,
        limit: HISTORY_PAGE_SIZE_DEFAULT,
        offset: 0,
      });
      if (version !== queryVersion) return;
      entries = result.entries;
      total = result.total;
    } catch (err: any) {
      if (version !== queryVersion) return;
      console.error('Error al cargar el historial:', err);
    } finally {
      if (version === queryVersion) loading = false;
    }
  }

  async function loadMore() {
    if (loading || loadingMore || !hasMore) return;
    loadingMore = true;
    const version = queryVersion;
    try {
      const result = await handyDB.queryHistory({
        action: actionFilter,
        term: debouncedSearch,
        from: fromDate || undefined,
        to: toDate || undefined,
        limit: HISTORY_PAGE_SIZE_DEFAULT,
        offset: entries.length,
      });
      if (version !== queryVersion) return;
      entries = [...entries, ...result.entries];
      total = result.total;
    } catch (err: any) {
      if (version !== queryVersion) return;
      console.error('Error al cargar más historial:', err);
    } finally {
      if (version === queryVersion) loadingMore = false;
    }
  }

  // Debounce the search field so typing doesn't fire a query per keystroke.
  $effect(() => {
    const term = searchInput;
    const timer = setTimeout(() => {
      debouncedSearch = term;
    }, 250);
    return () => clearTimeout(timer);
  });

  // Load (or reload) whenever the filters, page size or database refresh change.
  $effect(() => {
    debouncedSearch;
    actionFilter;
    fromDate;
    toDate;
    handyDB.historyEpoch;
    void reload();
  });

  // Infinite scroll: when the sentinel at the end of the list becomes visible,
  // fetch the next page.
  const watchInfiniteScroll = (node: HTMLElement) => {
    const observer = new IntersectionObserver(
      (intersections) => {
        if (intersections.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  };

  function clearDates() {
    fromDate = '';
    toDate = '';
  }

  function todayISO(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // Si solo se selecciona "desde", acotar "hasta" a hoy.
  $effect(() => {
    if (fromDate && !toDate) {
      const today = todayISO();
      if (fromDate <= today) {
        toDate = today;
      }
    }
  });

  async function exportCsv() {
    exportError = null;
    exportSuccess = null;
    let all: HistoryEntry[];
    try {
      all = await handyDB.exportHistory(
        actionFilter,
        debouncedSearch,
        fromDate || undefined,
        toDate || undefined,
      );
    } catch (err: any) {
      exportError = err.message || 'Error al consultar el historial';
      return;
    }
    if (all.length === 0) {
      exportError = 'No hay registros que exportar';
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
      const csv = historyToCsv(all);
      await invoke('write_text_file', { path, contents: csv });
      exportSuccess = `Historial exportado (${all.length} registro ${all.length === 1 ? '' : 's'})`;
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
      <div class="history-controls">
        <span class="history-count" title="Total de registros que coinciden con el filtro">
          {#if loading && entries.length === 0}
            Cargando...
          {:else}
            {total} Registros Totales
          {/if}
        </span>
        <button
          type="button"
          class="stat-chip"
          class:active={actionFilter === 'assign'}
          onclick={() => toggleFilter('assign')}
          title={actionFilter === 'assign' ? 'Mostrar todos' : 'Filtrar vinculados'}
        >
          Vinculados <span>{handyDB.historyAssignCount}</span>
        </button>
        <button
          type="button"
          class="stat-chip danger"
          class:active={actionFilter === 'unassign'}
          onclick={() => toggleFilter('unassign')}
          title={actionFilter === 'unassign' ? 'Mostrar todos' : 'Filtrar desvinculados'}
        >
          Desvinculados <span>{handyDB.historyUnassignCount}</span>
        </button>
        <div class="date-range-group">
          <label for="history-from">Desde</label>
          <input
            id="history-from"
            type="date"
            bind:value={fromDate}
            max={toDate || undefined}
            title="Desde esta fecha"
          />
          <span class="date-sep" aria-hidden="true">→</span>
          <label for="history-to">Hasta</label>
          <input
            id="history-to"
            type="date"
            bind:value={toDate}
            min={fromDate || undefined}
            title="Hasta esta fecha"
          />
          <button
            type="button"
            class="date-clear"
            onclick={clearDates}
            title="Limpiar filtro de fechas"
            disabled={!fromDate && !toDate}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="history-export-group">
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
            {exporting ? 'Exportando...' : 'Exportar a CSV'}
          </button>
          <button
            type="button"
            class="backup-btn"
            onclick={() => (showBackupModal = true)}
            title="Crear o restaurar copias de seguridad"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
            </svg>
            Copia de seguridad
          </button>
        </div>
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

      <div class="history-search">
        <SearchInput
          id="history-search"
          bind:value={searchInput}
          placeholder="Buscar por funcionario, # de handy o área..."
        />
      </div>
    </div>

    <div class="history-list">
      {#if loading && entries.length === 0}
        <div class="history-empty">Cargando historial...</div>
      {:else}
        {#each entries as entry (entry.id)}
          <div class="history-item" class:is-unassign={entry.action === 'unassign'}>
            <span class="handy-badge-sm">Handy #{entry.handy_id}</span>
            <div class="history-main">
              <span class="history-action">
                {#if entry.action === 'assign'}
                  Se vinculó a <strong>{entry.owner_name}</strong>
                {:else}
                  Se desvinculó de <strong>{entry.owner_name}</strong>
                {/if}
                {#if entry.area_name}
                  <span class="area-badge history-area">{entry.area_name}</span>
                {/if}
              </span>
              <span class="history-date">{formatDate(entry.timestamp)}</span>
            </div>
          </div>
        {/each}

        {#if entries.length === 0}
          <div class="history-empty">No hay registros que coincidan con el filtro</div>
        {:else if hasMore}
          <div class="history-load-more">
            {#if loadingMore}
              Cargando más...
            {:else}
              Scrolleá para cargar más registros
            {/if}
          </div>
        {:else}
          <div class="history-load-more end">Fin del historial</div>
        {/if}

        <div {@attach watchInfiniteScroll} class="history-sentinel" aria-hidden="true"></div>
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

{#if showBackupModal}
  <BackupModal onclose={() => (showBackupModal = false)} />
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
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    margin: -20px -24px 0;
    padding: 20px 24px 16px;
    background: linear-gradient(
      to bottom,
      var(--modal-bg) 0%,
      var(--modal-bg) 72%,
      transparent 100%
    );
  }

  .history-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .history-export-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .history-search {
    width: 100%;
  }

  .history-search :global(.search-group) {
    width: 100%;
  }

  .history-count {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    background: var(--surface-subtle);
    border: 1px solid var(--border-1);
    color: var(--text-secondary);
    padding: 0 14px;
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .history-count:not(:empty)::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-accent);
    flex-shrink: 0;
  }

  .date-range-group {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    background: var(--surface-subtle);
    border: 1px solid var(--border-1);
    color: var(--text-secondary);
    padding: 0 12px;
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.85rem;
    flex-wrap: wrap;
  }

  .date-range-group label {
    color: var(--text-muted);
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .date-range-group input[type='date'] {
    background: var(--date-input-bg);
    border: 1px solid var(--border-2);
    color: var(--text-primary);
    padding: 4px 8px;
    border-radius: 6px;
    font-family: var(--font-body);
    font-size: 0.85rem;
    color-scheme: var(--scheme);
  }

  .date-range-group input[type='date']:focus {
    outline: 2px solid var(--color-accent-border);
    border-color: var(--color-accent);
  }

  .date-sep {
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  .date-clear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .date-clear svg {
    width: 13px;
    height: 13px;
  }

  .date-clear:hover:not(:disabled) {
    background: rgba(244, 63, 94, 0.15);
    color: var(--color-danger);
  }

  .date-clear:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .stat-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    background: var(--surface-subtle);
    border: 1px solid var(--border-1);
    color: var(--text-secondary);
    padding: 0 14px;
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
    background: var(--surface-hover);
    border-color: var(--color-accent-border);
    color: var(--text-primary);
  }

  .stat-chip.danger.active {
    border-color: rgba(244, 63, 94, 0.5);
    background: rgba(244, 63, 94, 0.12);
  }

  .export-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    background: rgba(16, 185, 129, 0.05);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: var(--color-success);
    padding: 0 14px;
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

  .backup-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    background: var(--surface-subtle);
    border: 1px solid var(--border-2);
    color: var(--color-accent);
    padding: 0 14px;
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .backup-btn svg {
    width: 14px;
    height: 14px;
  }

  .backup-btn:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: var(--border-strong);
  }

  .delete-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    background: rgba(244, 63, 94, 0.05);
    border: 1px solid rgba(244, 63, 94, 0.2);
    color: var(--color-danger);
    padding: 0 14px;
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

  .history-load-more {
    padding: 12px 16px;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.75rem;
    border: 1px dashed var(--border-2);
    border-radius: var(--radius-sm);
  }

  .history-load-more.end {
    color: var(--text-secondary);
  }

  .history-sentinel {
    height: 1px;
  }

  .history-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 16px;
    background: var(--surface-subtle);
    border: 1px solid var(--border-1);
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

  .history-action .history-area {
    margin-left: 8px;
    vertical-align: middle;
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
    border: 1px dashed var(--border-2);
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

    .history-controls {
      flex-wrap: wrap;
      justify-content: center;
    }

    .history-export-group {
      flex: 1;
    }

    .stat-chip,
    .export-btn,
    .backup-btn,
    .delete-btn,
    .history-count {
      flex: 1;
      justify-content: center;
      white-space: nowrap;
    }

    .date-range-group {
      flex: 1;
      justify-content: center;
    }

    .history-item {
      align-items: flex-start;
    }
  }
</style>
