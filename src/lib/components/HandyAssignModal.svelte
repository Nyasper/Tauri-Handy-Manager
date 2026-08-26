<script lang="ts">
  import AppModal from './AppModal.svelte';
  import Alert from './Alert.svelte';
  import SearchInput from './SearchInput.svelte';
  import AddOption from './AddOption.svelte';
  import AreaPickerModal from './AreaPickerModal.svelte';
  import { handyDB, type Handy, type Owner } from '$lib/services/db.service.svelte';
  import { toastService } from '$lib/services/toast.service.svelte';
  import { createFeedback } from '$lib/utils/feedback.svelte';

  let {
    handy,
    onclose,
  }: {
    handy: Handy | null;
    onclose: () => void;
  } = $props();

  let searchInput = $state('');
  // Snapshot the current owner once: the modal is remounted on each open
  // svelte-ignore state_referenced_locally
  let selectedOwnerId = $state<number | null>(handy?.owner_id ?? null);
  // Owner whose area is being changed via the picker modal
  let areaPickerOwner = $state<Owner | null>(null);
  // Chosen area for a brand-new owner created from the typed name
  let pendingAreaId = $state<number | null>(null);

  const feedback = createFeedback();

  // Unassigned funcionarios (plus the current owner, so they can be kept), filtered by name or area
  const filteredOwners = $derived.by(() => {
    const currentOwnerId = handy?.owner_id ?? null;
    return handyDB
      .filterOwnersByTerm(searchInput)
      .filter((o) => o.id === currentOwnerId || !handyDB.handyByOwner.has(o.id));
  });

  // Show "Agregar owner" when there's text that matches neither an existing owner (case-insensitive)
  // nor an area, but skip hiding it when the only match is a capitalization variant of an owner.
  const canAddNew = $derived(handyDB.canCreateOwner(searchInput, true));

  // Allow submitting when an owner from the visible list is selected or when the
  // typed name is a new one to create. Disables the button when the search yields
  // no results and there's no new name to create.
  const canSubmit = $derived(
    canAddNew || filteredOwners.some((o) => o.id === selectedOwnerId),
  );

  // True when a different owner than the current one is selected (reassignment)
  const isReassign = $derived(
    handy?.owner_id != null &&
      selectedOwnerId != null &&
      selectedOwnerId !== handy.owner_id,
  );

  function selectOwner(id: number) {
    selectedOwnerId = id;
    feedback.clear();
  }

  const pendingAreaName = $derived(
    handyDB.areas.find((a) => a.id === pendingAreaId)?.name ?? null,
  );

  function openNewAreaPicker() {
    feedback.clear();
    areaPickerOwner = null;
    const name = searchInput.trim();
    const currentId = pendingAreaId ?? handyDB.defaultAreaId;
    areaPickerOwner = {
      id: -1,
      name,
      area_id: currentId,
      area_name: handyDB.areas.find((a) => a.id === currentId)?.name ?? null,
    };
  }

  function openOwnerAreaPicker(owner: Owner) {
    feedback.clear();
    areaPickerOwner = owner;
  }

  async function handleAreaPicked(owner: Owner, areaId: number) {
    if (owner.id === -1) {
      // New owner not created yet: keep the choice for creation
      pendingAreaId = areaId;
      return;
    }
    await handyDB.updateOwnerArea(owner.id, areaId);
    toastService.success(
      `Área de "${owner.name}" cambiada a "${handyDB.areas.find((a) => a.id === areaId)?.name}"`,
    );
  }

  async function submitAssignment(e?: Event) {
    e?.preventDefault();
    if (!handy) return;
    feedback.clear();

    try {
      if (selectedOwnerId != null) {
        await handyDB.assignToOwner(handy.id, selectedOwnerId);
      } else {
        const name = searchInput.trim();
        if (!name) {
          feedback.setError('Selecciona una persona de la lista o escribe un nombre nuevo');
          return;
        }
        const owner = await handyDB.createOwner(name, pendingAreaId ?? undefined);
        await handyDB.assignToOwner(handy.id, owner.id);
      }
      onclose();
    } catch (err: any) {
      feedback.setError(err.message || 'Error al guardar los cambios');
    }
  }

  async function handleUnassign() {
    if (!handy) return;
    feedback.clear();

    try {
      await handyDB.unassign(handy.id);
      onclose();
    } catch (err: any) {
      feedback.setError(err.message || 'Error al desvincular el handy');
    }
  }

  async function handleUnpin() {
    if (!handy) return;
    feedback.clear();

    try {
      await handyDB.toggleFixed(handy.id);
    } catch (err: any) {
      feedback.setError(err.message || 'Error al desfijar el handy');
    }
  }
</script>

{#if handy}
  <AppModal title={`Handy #${handy.id}`} onclose={onclose}>
    <div class="modal-body">
      <div class="status-banner" class:banner-assigned={handy.owner_id}>
        {#if handy.owner_id}
          <div class="status-icon success-pulse"></div>
          <span>
            Asignado a <strong>{handy.owner_name}</strong>
            {#if handy.area_name}
              · <span class="text-muted">{handy.area_name}</span>
            {/if}
          </span>
        {:else}
          <div class="status-icon free-pulse"></div>
          <span>Estado: <strong>Libre / Disponible</strong></span>
        {/if}
      </div>

      {#if handy.fixed}
        <div class="fixed-banner">
          <p>
            Este handy está <strong>fijado</strong>. Para desvincularlo o reasignarlo, desfíjalo primero.
          </p>
          <button type="button" class="btn-secondary" onclick={handleUnpin}>
            Desfijar
          </button>
        </div>
      {:else}
        <form onsubmit={submitAssignment} class="assignment-form">
          <div class="form-group">
            <label for="assign-owner-search">Funcionario</label>
            <div class="assign-search" data-nav-section="search">
              <SearchInput
                id="assign-owner-search"
                bind:value={searchInput}
                placeholder="Buscar por nombre o área..."
              />
            </div>

            <div class="owners-list" data-nav-section="list">
              {#each filteredOwners as owner (owner.id)}
                {@const ownerHandyId = handyDB.handyByOwner.get(owner.id)}
                <div
                  class="owner-row"
                  class:selected={selectedOwnerId === owner.id}
                >
                  <button
                    type="button"
                    class="owner-select"
                    class:selected={selectedOwnerId === owner.id}
                    onclick={() => selectOwner(owner.id)}
                  >
                    <span class="owner-name">{owner.name}</span>
                    {#if ownerHandyId != null}
                      <span class="handy-badge-sm">Handy #{ownerHandyId}</span>
                    {/if}
                  </button>
                  {#if owner.area_name}
                    <button
                      type="button"
                      class="area-badge-btn"
                      title={`Cambiar área de ${owner.name}`}
                      onclick={() => openOwnerAreaPicker(owner)}
                    >
                      {owner.area_name}
                    </button>
                  {/if}
                </div>
              {/each}

              {#if canAddNew}
                <div class="new-owner-area">
                  <span class="new-owner-label">Área del nuevo funcionario:</span>
                  <button
                    type="button"
                    class="area-badge-btn"
                    title="Cambiar el área del nuevo funcionario"
                    onclick={openNewAreaPicker}
                  >
                    {pendingAreaName ?? 'Por defecto'}
                  </button>
                </div>

                <AddOption
                  label="Agregar funcionario"
                  text={searchInput.trim()}
                  suffix={` y asignar handy #${handy.id}`}
                  onclick={() => submitAssignment()}
                />
              {/if}
            </div>

            <span class="helper-text">
              Selecciona una persona de la lista o escribe un nombre nuevo: al confirmar se creará y asignará automáticamente. Podés cambiar el área tocando la etiqueta del área.
            </span>
          </div>

          {#if feedback.error}
            <Alert type="danger" onclick={feedback.clear}>{feedback.error}</Alert>
          {/if}

          <div class="action-buttons" data-nav-section="actions">
            {#if handy.owner_id}
              {#if isReassign}
                <button type="submit" class="btn-primary" disabled={!canSubmit}>
                  Reasignar Handy
                </button>
              {/if}
              <button type="button" class="btn-danger" onclick={handleUnassign}>
                Liberar Handy
              </button>
            {:else}
              <button type="submit" class="btn-primary w-full" disabled={!canSubmit}>
                Asignar Handy
              </button>
            {/if}
          </div>
        </form>
      {/if}
    </div>
  </AppModal>
{/if}

{#if areaPickerOwner}
  {@const pickerOwner = areaPickerOwner}
  <AreaPickerModal
    ownerName={pickerOwner.name}
    currentAreaId={pickerOwner.area_id}
    onclose={() => (areaPickerOwner = null)}
    onconfirm={(areaId) => handleAreaPicked(pickerOwner, areaId)}
  />
{/if}

<style>
  .modal-body {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .status-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--surface-subtle);
    border: 1px solid var(--border-1);
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .status-banner.banner-assigned {
    background: rgba(16, 185, 129, 0.03);
    border-color: rgba(16, 185, 129, 0.1);
    color: var(--text-primary);
  }

  .status-icon {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .success-pulse {
    background: var(--color-success);
    box-shadow: 0 0 10px var(--color-success);
    animation: pulse-subtle 2s infinite;
  }

  .free-pulse {
    background: var(--text-muted);
  }

  .text-muted {
    color: var(--text-muted);
  }

  .fixed-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.35);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .fixed-banner p {
    flex: 1;
    min-width: 0;
    line-height: 1.4;
  }

  .fixed-banner strong {
    color: #fbbf24;
  }

  .fixed-banner .btn-secondary {
    flex-shrink: 0;
    padding: 8px 14px;
    font-size: 0.85rem;
  }

  .assignment-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .form-group label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .assign-search {
    position: sticky;
    top: 0;
    z-index: 10;
    margin: 0 -24px;
    padding: 0 24px 12px;
    background: linear-gradient(
      to bottom,
      var(--modal-bg) 0%,
      var(--modal-bg) 72%,
      transparent 100%
    );
  }

  .owners-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 230px;
    overflow-y: auto;
    padding: 4px;
  }

  .owner-row {
    display: flex;
    align-items: stretch;
    gap: 6px;
    width: 100%;
    padding: 4px;
    background: var(--surface-subtle);
    border: 1px solid var(--border-1);
    border-radius: var(--radius-sm);
    transition: border-color var(--transition-fast), background var(--transition-fast);
  }

  .owner-row.selected {
    background: var(--surface-strong);
    border-color: var(--color-accent);
  }

  .owner-select {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 6px 6px 12px;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    text-align: left;
    cursor: pointer;
  }

  .owner-select:focus-visible,
  .area-badge-btn:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .owner-name {
    font-weight: 500;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .area-badge-btn {
    flex-shrink: 0;
    align-self: center;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--color-accent-border);
    color: var(--color-accent);
    font-family: var(--font-body);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: all var(--transition-fast);
  }

  .area-badge-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--color-accent);
  }

  .new-owner-area {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 2px 4px;
  }

  .new-owner-label {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .helper-text {
    font-size: 0.75rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .action-buttons {
    display: flex;
    gap: 12px;
    margin-top: 10px;
  }

  .action-buttons button {
    flex: 1;
  }

  .w-full {
    width: 100%;
  }

  @media (max-width: 480px) {
    .modal-body {
      padding: 16px;
    }

    .owner-select {
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
    }

    .action-buttons {
      flex-direction: column;
    }

    .action-buttons button {
      width: 100%;
    }

    .fixed-banner {
      flex-direction: column;
      align-items: stretch;
    }

    .fixed-banner .btn-secondary {
      width: 100%;
    }
  }
</style>
