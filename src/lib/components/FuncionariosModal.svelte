<script lang="ts">
  import { handyDB, type Owner } from '$lib\/services/db.service.svelte';
  import AppModal from './AppModal.svelte';
  import Alert from './Alert.svelte';
  import SearchInput from './SearchInput.svelte';
  import AddOption from './AddOption.svelte';
  import { modalService } from '$lib/services/modal.service.svelte';

  let { onclose }: { onclose: () => void } = $props();

  let activeTab = $state<'funcionarios' | 'areas' | 'handies'>('funcionarios');
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);

  // Search + add-funcionario state
  let searchInput = $state('');

  // Inline area-change state
  let areaEditOwnerId = $state<number | null>(null);
  let pendingAreaId = $state<number | null>(null);

  // Area create state
  let areaName = $state('');

  // Owners filtered by name or area
  const filteredOwners = $derived(
    (() => {
      const term = searchInput.trim().toLowerCase();
      if (!term) return handyDB.owners;
      return handyDB.owners.filter(
        (o) =>
          o.name.toLowerCase().includes(term) ||
          (o.area_name ?? '').toLowerCase().includes(term),
      );
    })(),
  );

  // Show "Agregar funcionario" when there's text that doesn't match an existing owner
  const canAddNew = $derived(
    searchInput.trim().length > 0 &&
      handyDB.findOwner(searchInput) === null,
  );

  // Number of owners per area (for display)
  const ownerCountByArea = $derived(
    new Map(
      handyDB.owners.reduce((acc, o) => {
        if (o.area_id != null) {
          acc.set(o.area_id, (acc.get(o.area_id) ?? 0) + 1);
        }
        return acc;
      }, new Map<number, number>()),
    ),
  );

  function clearFeedback() {
    error = null;
    success = null;
  }

  function setActiveTab(tab: 'funcionarios' | 'areas' | 'handies') {
    activeTab = tab;
    clearFeedback();
    searchInput = '';
    areaEditOwnerId = null;
    areaName = '';
  }

  async function addOwner() {
    const name = searchInput.trim();
    if (!name) return;
    clearFeedback();

    try {
      await handyDB.createOwner(name);
      success = `Funcionario "${name}" creado con éxito`;
      searchInput = '';
    } catch (err: any) {
      error = err.message || 'Error al crear el funcionario';
    }
  }

  async function renameOwner(owner: Owner) {
    const newName = await modalService.prompt({
      title: 'Renombrar funcionario',
      message: 'Ingresa el nuevo nombre del funcionario',
      defaultValue: owner.name,
      confirmLabel: 'Guardar',
    });
    if (newName == null) return;

    const trimmed = newName.trim();
    if (!trimmed) {
      error = 'El nombre del funcionario no puede estar vacío';
      return;
    }
    if (trimmed.toLowerCase() === owner.name.toLowerCase()) return;

    clearFeedback();
    try {
      await handyDB.updateOwner(owner.id, trimmed, owner.area_id ?? handyDB.defaultAreaId ?? 0);
      success = 'Funcionario actualizado con éxito';
    } catch (err: any) {
      error = err.message || 'Error al actualizar el funcionario';
    }
  }

  function startAreaEdit(owner: Owner) {
    areaEditOwnerId = owner.id;
    pendingAreaId = owner.area_id;
    clearFeedback();
  }

  function cancelAreaEdit() {
    areaEditOwnerId = null;
    pendingAreaId = null;
  }

  async function confirmAreaEdit(owner: Owner) {
    if (pendingAreaId == null) {
      error = 'Debes seleccionar un área';
      return;
    }
    clearFeedback();
    try {
      await handyDB.updateOwnerArea(owner.id, pendingAreaId);
      success = 'Área del funcionario actualizada con éxito';
      cancelAreaEdit();
    } catch (err: any) {
      error = err.message || 'Error al actualizar el área del funcionario';
    }
  }

  async function handleDeleteOwner(id: number) {
    const owner = handyDB.owners.find((o) => o.id === id);
    const handyId = handyDB.handyByOwner.get(id);
    const confirmMsg = handyId != null
      ? `"${owner?.name}" tiene asignado el Handy #${handyId}. Al eliminarlo, el handy quedará libre. ¿Continuar?`
      : `¿Eliminar al funcionario "${owner?.name}"?`;

    const confirmed = await modalService.confirm({
      title: 'Eliminar funcionario',
      message: confirmMsg,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;
    clearFeedback();

    try {
      await handyDB.deleteOwner(id);
      if (areaEditOwnerId === id) cancelAreaEdit();
      success = 'Funcionario eliminado con éxito';
    } catch (err: any) {
      error = err.message || 'Error al eliminar el funcionario';
    }
  }

  async function editArea(area: { id: number; name: string }) {
    const newName = await modalService.prompt({
      title: 'Renombrar área',
      message: 'Ingresa el nuevo nombre del área',
      defaultValue: area.name,
      confirmLabel: 'Guardar',
    });
    if (newName == null) return;

    const trimmed = newName.trim();
    if (!trimmed) {
      error = 'El nombre del área no puede estar vacío';
      return;
    }
    if (trimmed.toLowerCase() === area.name.toLowerCase()) return;

    clearFeedback();
    try {
      await handyDB.updateArea(area.id, trimmed);
      success = 'Área actualizada con éxito';
    } catch (err: any) {
      error = err.message || 'Error al actualizar el área';
    }
  }

  async function handleAreaSubmit(e: Event) {
    e.preventDefault();
    clearFeedback();

    try {
      await handyDB.createArea(areaName);
      success = 'Área creada con éxito';
      areaName = '';
    } catch (err: any) {
      error = err.message || 'Error al guardar el área';
    }
  }

  async function handleDeleteArea(id: number) {
    const area = handyDB.areas.find((a) => a.id === id);
    if (!area) return;
    const confirmed = await modalService.confirm({
      title: 'Eliminar área',
      message: `¿Eliminar el área "${area.name}"? Los funcionarios de esta área se moverán a otra.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;
    clearFeedback();

    try {
      await handyDB.deleteArea(id);
      success = 'Área eliminada con éxito';
    } catch (err: any) {
      error = err.message || 'Error al eliminar el área';
    }
  }

  async function addHandy() {
    clearFeedback();

    try {
      const id = await handyDB.createHandy();
      success = `Handy #${id} creado con éxito`;
    } catch (err: any) {
      error = err.message || 'Error al crear el handy';
    }
  }

  async function handleDeleteHandy(id: number) {
    const handy = handyDB.handies.find((h) => h.id === id);
    if (!handy) return;

    if (handy.owner_id != null) {
      error = `No se puede eliminar el Handy #${id} porque está asignado a "${handy.owner_name}". Desvincúlalo primero.`;
      return;
    }

    const confirmed = await modalService.confirm({
      title: 'Eliminar handy',
      message: `¿Eliminar el Handy #${id}?`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;
    clearFeedback();

    try {
      await handyDB.deleteHandy(id);
      success = `Handy #${id} eliminado con éxito`;
    } catch (err: any) {
      error = err.message || 'Error al eliminar el handy';
    }
  }
</script>

<AppModal title="Administración" onclose={onclose}>
  <div class="tabs">
      <button
        class="tab-btn"
        class:active={activeTab === 'funcionarios'}
        onclick={() => setActiveTab('funcionarios')}
      >
        Administración
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === 'areas'}
        onclick={() => setActiveTab('areas')}
      >
        Áreas
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === 'handies'}
        onclick={() => setActiveTab('handies')}
      >
        Handies
      </button>
    </div>

    {#if activeTab === 'funcionarios'}
      <div class="modal-body">
        <SearchInput
          id="owner-search"
          bind:value={searchInput}
          placeholder="Buscar por nombre o área..."
        />

        <div class="funcionarios-list">
          {#each filteredOwners as owner (owner.id)}
            <div class="row-item">
              <div class="row-info">
                <span class="row-name">{owner.name}</span>
                <span class="row-meta">
                  {#if owner.area_name}
                    <span class="area-badge">{owner.area_name}</span>
                  {:else}
                    <span class="row-muted">Sin área</span>
                  {/if}
                  {#if handyDB.handyByOwner.get(owner.id) != null}
                    <span class="handy-badge-sm">Handy #{handyDB.handyByOwner.get(owner.id)}</span>
                  {/if}
                </span>
              </div>
              <div class="row-actions">
                <button type="button" class="btn-secondary btn-sm" onclick={() => renameOwner(owner)}>
                  Renombrar
                </button>
                <button type="button" class="btn-secondary btn-sm" onclick={() => startAreaEdit(owner)}>
                  Cambiar área
                </button>
                <button type="button" class="btn-danger btn-sm" onclick={() => handleDeleteOwner(owner.id)}>
                  Eliminar
                </button>
              </div>
            </div>

            {#if areaEditOwnerId === owner.id}
              <div class="quick-area-panel">
                <p class="quick-title">
                  Cambiar área de <strong>{owner.name}</strong>
                </p>
                <select bind:value={pendingAreaId}>
                  {#each handyDB.areas as area (area.id)}
                    <option value={area.id}>{area.name}</option>
                  {/each}
                </select>
                <div class="form-actions">
                  <button type="button" class="btn-primary btn-sm" onclick={() => confirmAreaEdit(owner)}>
                    Confirmar
                  </button>
                  <button type="button" class="btn-secondary btn-sm" onclick={cancelAreaEdit}>
                    Cancelar
                  </button>
                </div>
              </div>
            {/if}
          {/each}

          {#if canAddNew}
            <AddOption
              label="Agregar funcionario:"
              text={searchInput.trim()}
              onclick={addOwner}
            />
          {/if}
        </div>
      </div>
    {:else if activeTab === 'areas'}
      <div class="modal-body">
        <div class="funcionarios-list">
          {#each handyDB.areas as area (area.id)}
            <div class="row-item">
              <div class="row-info">
                <span class="row-name">{area.name}</span>
                <span class="row-meta">
                  <span class="row-muted">
                    {(ownerCountByArea.get(area.id) ?? 0)} funcionarios
                  </span>
                </span>
              </div>
              <div class="row-actions">
                <button type="button" class="btn-secondary btn-sm" onclick={() => editArea(area)}>
                  Renombrar
                </button>
                <button type="button" class="btn-danger btn-sm" onclick={() => handleDeleteArea(area.id)}>
                  Eliminar
                </button>
              </div>
            </div>
          {/each}
        </div>

        <form onsubmit={handleAreaSubmit} class="modal-form">
          <h4>Nueva área</h4>
          <div class="form-group">
            <label for="modal-area-name">Nombre del área</label>
            <input
              type="text"
              id="modal-area-name"
              bind:value={areaName}
              placeholder="Ej. Seguridad"
              autocomplete="off"
            />
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-primary btn-sm">
              Crear área
            </button>
          </div>
        </form>
      </div>
    {:else}
      <div class="modal-body">
        <div class="list-header">
          <span class="row-muted">{handyDB.handies.length} handies</span>
          <button type="button" class="btn-primary btn-sm" onclick={addHandy}>
            Agregar handy
          </button>
        </div>
        <div class="funcionarios-list">
          {#each handyDB.handies as handy (handy.id)}
            <div class="row-item">
              <div class="row-info">
                <span class="row-name">Handy #{handy.id}</span>
                <span class="row-meta">
                  {#if handy.owner_name}
                    <span class="owner-badge">{handy.owner_name}</span>
                    {#if handy.area_name}
                      <span class="area-badge">{handy.area_name}</span>
                    {/if}
                  {:else}
                    <span class="row-muted">Libre</span>
                  {/if}
                  {#if handy.fixed}
                    <span class="fixed-badge">Fijado</span>
                  {/if}
                </span>
              </div>
              <div class="row-actions">
                <button type="button" class="btn-danger btn-sm" onclick={() => handleDeleteHandy(handy.id)}>
                  Eliminar
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if error}
      <Alert type="danger" icon={false} class="modal-alert">{error}</Alert>
    {/if}
    {#if success}
      <Alert type="success" icon={false} class="modal-alert">{success}</Alert>
    {/if}
</AppModal>

<style>
  .tabs {
    display: flex;
    gap: 8px;
    padding: 16px 24px 0;
  }

  .tab-btn {
    flex: 1;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--text-secondary);
    padding: 10px;
    font-family: var(--font-header);
    font-weight: 600;
    font-size: 0.9rem;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .tab-btn.active {
    background: rgba(255, 255, 255, 0.12);
    border-color: var(--color-accent-border);
    color: #fff;
  }

  .modal-body {
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    overflow-y: auto;
  }

  .funcionarios-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .quick-area-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-sm);
  }

  .quick-title {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .row-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-sm);
  }

  .row-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .row-name {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .row-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .row-muted {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .row-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .btn-sm {
    padding: 6px 12px;
    font-size: 0.8rem;
    border-radius: var(--radius-sm);
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .modal-form h4 {
    font-size: 0.95rem;
    color: var(--text-primary);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .form-actions {
    display: flex;
    gap: 8px;
  }

  :global(.modal-alert) {
    margin: 0 24px 20px;
  }

  @media (max-width: 480px) {
    .tabs {
      gap: 6px;
      padding: 12px 16px 0;
    }

    .tab-btn {
      padding: 8px 6px;
      font-size: 0.8rem;
      white-space: nowrap;
    }

    .modal-body {
      padding: 14px 16px;
    }

    .row-item {
      flex-direction: column;
      align-items: stretch;
    }

    .row-name {
      overflow-wrap: anywhere;
    }

    .row-actions {
      flex-wrap: wrap;
    }

    .row-actions .btn-sm {
      flex: 1;
      min-width: 90px;
    }

    .list-header {
      flex-wrap: wrap;
    }

    :global(.modal-alert) {
      margin: 0 16px 14px;
    }
  }
</style>
