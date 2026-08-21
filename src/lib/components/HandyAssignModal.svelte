<script lang="ts">
  import AppModal from './AppModal.svelte';
  import Alert from './Alert.svelte';
  import SearchInput from './SearchInput.svelte';
  import AddOption from './AddOption.svelte';
  import { handyDB, type Handy } from '$lib\/services/db.service.svelte';

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
  let actionError = $state<string | null>(null);
  let actionSuccess = $state<string | null>(null);

  // Unassigned funcionarios (plus the current owner, so they can be kept), filtered by name or area
  const filteredOwners = $derived(
    (() => {
      const term = searchInput.trim().toLowerCase();
      return handyDB.owners.filter((o) => {
        const isCurrent = handy?.owner_id != null && o.id === handy.owner_id;
        const isUnassigned = !handyDB.handyByOwner.has(o.id);
        if (!isCurrent && !isUnassigned) return false;
        if (!term) return true;
        return (
          o.name.toLowerCase().includes(term) ||
          (o.area_name ?? '').toLowerCase().includes(term)
        );
      });
    })(),
  );

  // Show "Agregar owner" when there's text that matches neither an existing owner (case-insensitive)
  // nor an area, but skip hiding it when the only match is a capitalization variant of an owner.
  const canAddNew = $derived(
    (() => {
      const text = searchInput.trim();
      if (!text) return false;
      const existing = handyDB.findOwner(text);
      if (existing !== null && existing.name === text) return false;
      return handyDB.areas.every(
        (a) => a.name.trim().toLowerCase() !== text.toLowerCase(),
      );
    })(),
  );

  function clearFeedback() {
    actionError = null;
    actionSuccess = null;
  }

  function selectOwner(id: number) {
    selectedOwnerId = id;
    clearFeedback();
  }

  async function addNewOwner() {
    const name = searchInput.trim();
    if (!name) return;
    clearFeedback();

    try {
      const owner = await handyDB.createOwner(name);
      selectedOwnerId = owner.id;
      searchInput = '';
      actionSuccess = `"${owner.name}" creado; pulsa el botón para confirmar la asignación`;
    } catch (err: any) {
      actionError = err.message || 'Error al crear el funcionario';
    }
  }

  async function handleSave(e: Event) {
    e.preventDefault();
    if (!handy) return;
    clearFeedback();

    if (selectedOwnerId == null) {
      actionError = 'Selecciona una persona de la lista';
      return;
    }

    try {
      await handyDB.assignToOwner(handy.id, selectedOwnerId);
      onclose();
    } catch (err: any) {
      actionError = err.message || 'Error al guardar los cambios';
    }
  }

  async function handleUnassign() {
    if (!handy) return;
    clearFeedback();

    try {
      await handyDB.unassign(handy.id);
      onclose();
    } catch (err: any) {
      actionError = err.message || 'Error al desvincular el handy';
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

      <form onsubmit={handleSave} class="assignment-form">
        <div class="form-group">
          <label for="assign-owner-search">Funcionario</label>
          <div data-nav-section="search">
            <SearchInput
              id="assign-owner-search"
              bind:value={searchInput}
              placeholder="Buscar por nombre o área..."
            />
          </div>

          <div class="owners-list" data-nav-section="list">
            {#each filteredOwners as owner (owner.id)}
              <button
                type="button"
                class="owner-item"
                class:selected={selectedOwnerId === owner.id}
                onclick={() => selectOwner(owner.id)}
              >
                <span class="owner-name">{owner.name}</span>
                <span class="owner-meta">
                  {#if owner.area_name}
                    <span class="area-badge">{owner.area_name}</span>
                  {/if}
                  {#if handyDB.handyByOwner.get(owner.id) != null}
                    <span class="handy-badge-sm">Handy #{handyDB.handyByOwner.get(owner.id)}</span>
                  {/if}
                </span>
              </button>
            {/each}

            {#if canAddNew}
              <AddOption
                label="Agregar funcionario:"
                text={searchInput.trim()}
                onclick={addNewOwner}
              />
            {/if}
          </div>

          <span class="helper-text">
            Selecciona una persona de la lista o escribe un nombre nuevo para crearla. El área se asigna desde "Administración".
          </span>
        </div>

        {#if actionError}
          <Alert type="danger">{actionError}</Alert>
        {/if}

        {#if actionSuccess}
          <Alert type="success">{actionSuccess}</Alert>
        {/if}

        <div class="action-buttons" data-nav-section="actions">
          {#if handy.owner_id}
            <button type="submit" class="btn-primary" disabled={selectedOwnerId == null}>
              Guardar Cambios
            </button>
            <button type="button" class="btn-danger" onclick={handleUnassign}>
              Desvincular
            </button>
          {:else}
            <button type="submit" class="btn-primary w-full" disabled={selectedOwnerId == null}>
              Asignar Handy
            </button>
          {/if}
        </div>
      </form>
    </div>
  </AppModal>
{/if}

<style>
  .modal-body {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    overflow-y: auto;
  }

  .status-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
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

  .owners-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 230px;
    overflow-y: auto;
    padding-right: 4px;
  }

  .owner-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    text-align: left;
    cursor: pointer;
  }

  .owner-item.selected {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--color-accent);
  }

  .owner-name {
    font-weight: 500;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .owner-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
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

    .owner-meta {
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .action-buttons {
      flex-direction: column;
    }

    .action-buttons button {
      width: 100%;
    }
  }
</style>
