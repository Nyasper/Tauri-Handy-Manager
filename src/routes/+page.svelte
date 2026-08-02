<script lang="ts">
  import { handyDB, type Handy } from '$lib\/services/db.service.svelte';
  import AppHeader from '$lib/components/AppHeader.svelte';
  import HandiesGrid from '$lib/components/HandiesGrid.svelte';
  import FuncionariosModal from '$lib/components/FuncionariosModal.svelte';
  import HistorialModal from '$lib/components/HistorialModal.svelte';
  import HandyAssignModal from '$lib/components/HandyAssignModal.svelte';
  import { contextMenu, type ContextMenuItem } from '$lib/services/context-menu.service.svelte';
  import { shortcuts } from '$lib/services/shortcuts.service.svelte';

  let filterInput = $state('');
  let activeFilter = $state<'all' | 'assigned' | 'free'>('all');
  let showFuncionariosModal = $state(false);
  let showHistorialModal = $state(false);
  let assignHandyId = $state<number | null>(null);

  // Expose app actions to the global keyboard shortcuts service
  $effect(() => {
    const unregister = shortcuts.setAppActions({
      openAdmin: () => (showFuncionariosModal = true),
      openHistory: () => (showHistorialModal = true),
      quickSelect: (id) => {
        assignHandyId = id;
      },
      resetView: () => {
        filterInput = '';
      },
    });
    return unregister;
  });

  // Derived properties
  const assignHandy = $derived(assignHandyId !== null ? handyDB.handies.find(h => h.id === assignHandyId) ?? null : null);
  const totalCount = $derived(handyDB.handies.length);
  const assignedCount = $derived(handyDB.handies.filter(h => h.owner_id !== null).length);
  const freeCount = $derived(totalCount - assignedCount);
  const filteredHandies = $derived(
    (() => {
      const term = filterInput.trim().toLowerCase();
      return handyDB.handies.filter(h => {
        if (activeFilter === 'assigned' && h.owner_id === null) return false;
        if (activeFilter === 'free' && h.owner_id !== null) return false;
        if (term) {
          return (
            (h.owner_name ?? '').toLowerCase().includes(term) ||
            (h.area_name ?? '').toLowerCase().includes(term)
          );
        }
        return true;
      });
    })(),
  );
  const fixedHandies = $derived(filteredHandies.filter(h => h.fixed));
  const otherHandies = $derived(filteredHandies.filter(h => !h.fixed));

  // Toggle the status filter; clicking the active one again shows all
  function toggleFilter(filter: 'assigned' | 'free') {
    activeFilter = activeFilter === filter ? 'all' : filter;
  }

  // Open the assign modal for a handy
  function openAssignModal(id: number) {
    assignHandyId = id;
  }

  // Build and show the context menu for a handy card
  function handleHandyContextMenu(e: MouseEvent, handy: Handy) {
    let items: ContextMenuItem[];

    if (handy.owner_id === null) {
      items = [
        { label: 'Asignar handy', action: () => openAssignModal(handy.id) },
      ];
    } else {
      items = [
        {
          label: 'Revocar Asignación',
          action: () => handyDB.unassign(handy.id),
        },
        { isSeparator: true },
        {
          label: 'Reasignar handy',
          action: () => openAssignModal(handy.id),
        },
        { isSeparator: true },
        {
          label: handy.fixed ? 'Desfijar' : 'Fijar handy',
          action: () => handyDB.toggleFixed(handy.id),
        },
      ];
    }

    contextMenu.show(e, 'handy', items);
  }
</script>

<div class="dashboard-container animate-fade">
  <AppHeader
    {totalCount}
    {assignedCount}
    {freeCount}
    {activeFilter}
    onfilter={toggleFilter}
    onfuncionarios={() => (showFuncionariosModal = true)}
    onhistorial={() => (showHistorialModal = true)}
  />

  <HandiesGrid
    {fixedHandies}
    {otherHandies}
    {filteredHandies}
    bind:filterInput
    onassign={openAssignModal}
    onpin={(id) => handyDB.toggleFixed(id)}
    oncontextmenu={handleHandyContextMenu}
  />

  <footer class="shortcut-hints">
    <span class="hint"><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> Navegar</span>
    <span class="hint"><kbd>Enter</kbd> Aceptar</span>
    <span class="hint"><kbd>Esc</kbd>/<kbd>Supr</kbd> Salir / Volver</span>
    <span class="hint"><kbd>1</kbd>-<kbd>0</kbd> / <kbd>Ctrl</kbd>+<kbd>1</kbd>-<kbd>0</kbd> Handy 1-20</span>
    <span class="hint"><kbd>Ctrl</kbd>+<kbd>O</kbd> Administración</span>
    <span class="hint"><kbd>Ctrl</kbd>+<kbd>H</kbd> Historial</span>
  </footer>
</div>

{#if assignHandyId !== null}
  <HandyAssignModal handy={assignHandy} onclose={() => (assignHandyId = null)} />
{/if}

{#if showFuncionariosModal}
  <FuncionariosModal onclose={() => (showFuncionariosModal = false)} />
{/if}

{#if showHistorialModal}
  <HistorialModal onclose={() => (showHistorialModal = false)} />
{/if}

<style>
  .dashboard-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 30px 20px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-height: 100vh;
  }

  .shortcut-hints {
    margin-top: auto;
    padding-top: 24px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 6px 20px;
    color: var(--text-muted);
    font-size: 0.75rem;
  }

  .hint {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
  }

  .hint kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-bottom-width: 2px;
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 0.65rem;
    line-height: 1;
  }

  @media (max-width: 1024px) {
    .dashboard-container {
      padding: 24px 16px;
    }
  }

  @media (max-width: 480px) {
    .dashboard-container {
      padding: 14px 10px;
    }

    .shortcut-hints {
      font-size: 0.68rem;
      gap: 4px 14px;
    }
  }
</style>
