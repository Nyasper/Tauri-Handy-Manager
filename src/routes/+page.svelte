<script lang="ts">
  import { handyDB, type Handy } from '$lib/services/db.service.svelte';
  import AppHeader from '$lib/components/AppHeader.svelte';
  import HandiesGrid from '$lib/components/HandiesGrid.svelte';
  import FuncionariosModal from '$lib/components/FuncionariosModal.svelte';
  import HistorialModal from '$lib/components/HistorialModal.svelte';
  import HandyAssignModal from '$lib/components/HandyAssignModal.svelte';
  import AreaPickerModal from '$lib/components/AreaPickerModal.svelte';
  import { contextMenu, type ContextMenuItem } from '$lib/services/context-menu.service.svelte';
  import { shortcuts } from '$lib/services/shortcuts.service.svelte';
  import { toastService } from '$lib/services/toast.service.svelte';

  let filterInput = $state('');
  let activeFilter = $state<'all' | 'assigned' | 'free'>('all');
  let showFuncionariosModal = $state(false);
  let showHistorialModal = $state(false);
  let assignHandyId = $state<number | null>(null);
  let areaPickerOwnerId = $state<number | null>(null);

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
            String(h.id) === term ||
            (h.owner_name ?? '').toLowerCase().includes(term) ||
            (h.area_name ?? '').toLowerCase().includes(term)
          );
        }
        return true;
      });
    })(),
  );

  // Toggle the status filter; clicking the active one again shows all
  function toggleFilter(filter: 'assigned' | 'free') {
    activeFilter = activeFilter === filter ? 'all' : filter;
  }

  // True when any filter (status or text) is active
  const hasActiveFilter = $derived(activeFilter !== 'all' || filterInput.trim() !== '');

  // Clear all filters and show the full list
  function clearFilters() {
    activeFilter = 'all';
    filterInput = '';
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
      items = [];
      if (!handy.fixed) {
        items.push(
          { label: 'Liberar Handy', action: () => handyDB.unassign(handy.id) },
          { isSeparator: true },
          { label: 'Reasignar handy', action: () => openAssignModal(handy.id) },
          { isSeparator: true },
        );
      }
      items.push({
        label: handy.fixed ? 'Desfijar' : 'Fijar handy',
        action: () => handyDB.toggleFixed(handy.id),
      });
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
    {hasActiveFilter}
    onfilter={toggleFilter}
    onclear={clearFilters}
    onfuncionarios={() => (showFuncionariosModal = true)}
    onhistorial={() => (showHistorialModal = true)}
  />

  <HandiesGrid
    {filteredHandies}
    {hasActiveFilter}
    onclear={clearFilters}
    bind:filterInput
    onassign={openAssignModal}
    onpin={(id) => handyDB.toggleFixed(id)}
    onarea={(ownerId) => (areaPickerOwnerId = ownerId)}
    oncontextmenu={handleHandyContextMenu}
  />

  <footer class="shortcut-hints">
    <span class="hint"><kbd>1</kbd>-<kbd>0</kbd> / <kbd>Ctrl</kbd>+<kbd>1</kbd>-<kbd>0</kbd> Handy 1-20</span>
    <span class="hint"><kbd>Ctrl</kbd>+<kbd>H</kbd> Historial</span>
    <span class="hint"><kbd>Ctrl</kbd>+<kbd>O</kbd> Administración</span>
    <span class="hint"><kbd>Ctrl</kbd>+<kbd>T</kbd> Modo claro/oscuro</span>
  </footer>
</div>

{#if assignHandyId !== null}
  <HandyAssignModal handy={assignHandy} onclose={() => (assignHandyId = null)} />
{/if}

{#if areaPickerOwnerId !== null}
  {@const areaOwner = handyDB.owners.find((o) => o.id === areaPickerOwnerId)}
  {#if areaOwner}
    <AreaPickerModal
      ownerName={areaOwner.name}
      currentAreaId={areaOwner.area_id}
      onclose={() => (areaPickerOwnerId = null)}
      onconfirm={async (areaId) => {
        await handyDB.updateOwnerArea(areaOwner.id, areaId);
        toastService.success(
          `Área de "${areaOwner.name}" cambiada a "${handyDB.areas.find((a) => a.id === areaId)?.name}"`,
        );
      }}
    />
  {/if}
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
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
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
    flex-shrink: 0;
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
    background: var(--surface-1);
    border: 1px solid var(--border-2);
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
