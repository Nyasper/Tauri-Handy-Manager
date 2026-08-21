<script lang="ts">
  import { handyDB, type Owner } from '$lib/services/db.service.svelte';
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

  // Show "Agregar funcionario" when there's text that doesn't match an existing owner,
  // or matches one only as a capitalization variant (so it can be corrected).
  const canAddNew = $derived(
    (() => {
      const text = searchInput.trim();
      if (!text) return false;
      const existing = handyDB.findOwner(text);
      return existing === null || existing.name !== text;
    })(),
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

  let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  // Auto-dismiss the toast after 3 seconds
  $effect(() => {
    if (error || success) {
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

  function setActiveTab(tab: 'funcionarios' | 'areas' | 'handies') {
    activeTab = tab;
    clearFeedback();
    searchInput = '';
    areaEditOwnerId = null;
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
      error = err.message || `Error al crear el funcionario "${name}"`;
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
    if (trimmed === owner.name) return;

    const areaId = owner.area_id ?? handyDB.defaultAreaId;
    if (areaId == null) {
      error = 'No hay áreas disponibles';
      return;
    }

    clearFeedback();
    try {
      await handyDB.updateOwner(owner.id, trimmed, areaId);
      success = `Funcionario "${owner.name}" renombrado a "${trimmed}"`;
    } catch (err: any) {
      error = err.message || `Error al actualizar el funcionario "${owner.name}"`;
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
    const area = handyDB.areas.find((a) => a.id === pendingAreaId);
    try {
      await handyDB.updateOwnerArea(owner.id, pendingAreaId);
      success = `Área de "${owner.name}" cambiada a "${area?.name}"`;
      cancelAreaEdit();
    } catch (err: any) {
      error = err.message || `Error al actualizar el área de "${owner.name}"`;
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
      success = `Funcionario "${owner?.name}" eliminado con éxito`;
    } catch (err: any) {
      error = err.message || `Error al eliminar el funcionario "${owner?.name}"`;
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
    if (trimmed === area.name) return;

    clearFeedback();
    try {
      await handyDB.updateArea(area.id, trimmed);
      success = `Área "${area.name}" renombrada a "${trimmed}"`;
    } catch (err: any) {
      error = err.message || `Error al actualizar el área "${area.name}"`;
    }
  }

  async function addArea() {
    clearFeedback();

    const name = await modalService.prompt({
      title: 'Nueva área',
      message: 'Ingresa el nombre del área',
      defaultValue: '',
      confirmLabel: 'Crear',
    });
    if (name == null) return;

    const trimmed = name.trim();
    if (!trimmed) {
      error = 'El nombre del área no puede estar vacío';
      return;
    }

    try {
      await handyDB.createArea(trimmed);
      success = `Área "${trimmed}" creada con éxito`;
    } catch (err: any) {
      error = err.message || `Error al crear el área "${trimmed}"`;
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
      success = `Área "${area.name}" eliminada con éxito`;
    } catch (err: any) {
      error = err.message || `Error al eliminar el área "${area.name}"`;
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
      error = err.message || `Error al eliminar el Handy #${id}`;
    }
  }
</script>

<AppModal title="Administración" onclose={onclose}>
  <div class="admin-toolbar">
    <div class="tabs" data-nav-section="tabs">
      <button
        class="tab-btn"
        class:active={activeTab === 'funcionarios'}
        onclick={() => setActiveTab('funcionarios')}
      >
        Funcionarios
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
      <div class="admin-search" data-nav-section="search">
        <SearchInput
          id="owner-search"
          bind:value={searchInput}
          placeholder="Buscar por nombre o área..."
        />
      </div>
    {/if}
  </div>

  {#if activeTab === 'funcionarios'}
    <div class="modal-body">
      <div class="funcionarios-list" data-nav-section="list">
          {#each filteredOwners as owner (owner.id)}
            {@const ownerHandyId = handyDB.handyByOwner.get(owner.id)}
            <div class="row-item">
              <div class="row-info">
                <span class="row-name">{owner.name}</span>
                <span class="row-meta">
                  {#if owner.area_name}
                    <span class="area-badge">{owner.area_name}</span>
                  {:else}
                    <span class="row-muted">Sin área</span>
                  {/if}
                  {#if ownerHandyId != null}
                    <span class="handy-badge-sm">Handy #{ownerHandyId}</span>
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
        <div class="list-header" data-nav-section="header">
          <span class="row-muted">{handyDB.areas.length} areas</span>
          <button type="button" class="btn-primary btn-sm" onclick={addArea}>
            Agregar área
          </button>
        </div>
        <div class="funcionarios-list" data-nav-section="list">
          {#each handyDB.areas as area (area.id)}
            {@const isDefaultArea = area.name.trim().toLowerCase() === 'otro'}
            <div class="row-item">
              <div class="row-info">
                <span class="row-name">
                  {area.name}
                  {#if isDefaultArea}
                    <span class="default-badge">Por defecto</span>
                  {/if}
                </span>
                <span class="row-meta">
                  <span class="row-muted">
                    {(ownerCountByArea.get(area.id) ?? 0)} funcionarios
                  </span>
                </span>
              </div>
              <div class="row-actions">
                <button
                  type="button"
                  class="btn-secondary btn-sm"
                  disabled={isDefaultArea}
                  title={isDefaultArea ? 'Área por defecto: no se puede modificar' : 'Renombrar área'}
                  onclick={() => editArea(area)}
                >
                  Renombrar
                </button>
                <button
                  type="button"
                  class="btn-danger btn-sm"
                  disabled={isDefaultArea}
                  title={isDefaultArea ? 'Área por defecto: no se puede eliminar' : 'Eliminar área'}
                  onclick={() => handleDeleteArea(area.id)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <div class="modal-body">
        <div class="list-header" data-nav-section="header">
          <span class="row-muted">{handyDB.handies.length} handies</span>
          <button type="button" class="btn-primary btn-sm" onclick={addHandy}>
            Agregar handy
          </button>
        </div>
        <div class="funcionarios-list" data-nav-section="list">
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
      <Alert type="danger" icon={false} class="admin-alert">{error}</Alert>
    {/if}
    {#if success}
      <Alert type="success" icon={false} class="admin-alert">{success}</Alert>
    {/if}
</AppModal>

<style>
  .admin-toolbar {
    position: sticky;
    top: 0;
    z-index: 10;
    padding: 16px 24px 12px;
    background: linear-gradient(
      to bottom,
      var(--modal-bg) 0%,
      var(--modal-bg) 72%,
      transparent 100%
    );
  }

  .tabs {
    display: flex;
    gap: 8px;
  }

  .admin-search {
    margin-top: 16px;
  }

  .tab-btn {
    flex: 1;
    background: var(--surface-subtle);
    border: 1px solid var(--border-1);
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
    background: var(--surface-hover);
    border-color: var(--color-accent-border);
    color: var(--text-primary);
  }

  .modal-body {
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
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
    background: var(--surface-subtle);
    border: 1px solid var(--border-1);
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
    background: var(--surface-subtle);
    border: 1px solid var(--border-1);
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
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .default-badge {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--color-accent);
    background: var(--surface-1);
    border: 1px solid var(--color-accent-border);
    border-radius: 999px;
    padding: 2px 8px;
    white-space: nowrap;
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
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .btn-sm {
    padding: 6px 12px;
    font-size: 0.8rem;
    border-radius: var(--radius-sm);
  }

  .form-actions {
    display: flex;
    gap: 8px;
  }

  :global(.admin-alert) {
    position: absolute;
    top: calc(100% + 12px);
    left: 24px;
    right: 24px;
    z-index: 30;
    margin: 0;
    pointer-events: none;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  @media (max-width: 480px) {
    .admin-toolbar {
      padding: 12px 16px 12px;
    }

    .tabs {
      gap: 6px;
    }

    .admin-search {
      margin-top: 12px;
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

    :global(.admin-alert) {
      left: 16px;
      right: 16px;
    }
  }
</style>
