<script lang="ts">
  import { handyDB } from '$lib/services/db.service.svelte';
  import AppModal from './AppModal.svelte';
  import Alert from './Alert.svelte';

  let {
    ownerName,
    currentAreaId,
    onclose,
    onconfirm,
  }: {
    ownerName: string;
    currentAreaId: number | null;
    onclose: () => void;
    onconfirm: (areaId: number) => void | Promise<void>;
  } = $props();

  // Snapshot the current area on open; the modal is remounted for each owner.
  // svelte-ignore state_referenced_locally
  let selectedAreaId = $state<number | null>(currentAreaId ?? handyDB.defaultAreaId);
  let error = $state<string | null>(null);
  let saving = $state(false);

  function handleConfirm() {
    if (selectedAreaId == null) {
      error = 'Debes seleccionar un área';
      return;
    }
    error = null;
    saving = true;
    Promise.resolve(onconfirm(selectedAreaId))
      .then(() => onclose())
      .catch((err: any) => {
        error = err.message || 'Error al cambiar el área';
      })
      .finally(() => {
        saving = false;
      });
  }
</script>

<AppModal title="Cambiar área" maxWidth="360px" {onclose}>
  <div class="modal-body">
    <p class="picker-hint">
      Área de <strong>{ownerName}</strong>
    </p>

    {#if handyDB.areas.length === 0}
      <Alert type="danger" icon={false} class="modal-alert">
        No hay áreas disponibles. Créalas desde "Administración".
      </Alert>
    {:else}
      <select bind:value={selectedAreaId} class="area-select">
        {#each handyDB.areas as area (area.id)}
          <option value={area.id}>{area.name}</option>
        {/each}
      </select>
    {/if}

    {#if error}
      <Alert type="danger" icon={false} class="modal-alert" onclick={() => (error = null)}>
        {error}
      </Alert>
    {/if}

    <div class="actions">
      <button
        type="button"
        class="btn-primary"
        disabled={saving || handyDB.areas.length === 0}
        onclick={handleConfirm}
      >
        {saving ? 'Guardando...' : 'Confirmar'}
      </button>
      <button type="button" class="btn-secondary" disabled={saving} onclick={onclose}>
        Cancelar
      </button>
    </div>
  </div>
</AppModal>

<style>
  .modal-body {
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .picker-hint {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .area-select {
    width: 100%;
    background: var(--surface-1);
    border: 1px solid var(--border-2);
    color: var(--text-primary);
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.9rem;
  }

  .area-select:focus {
    outline: 2px solid var(--color-accent-border);
    border-color: var(--color-accent);
  }

  .actions {
    display: flex;
    gap: 10px;
  }

  .actions button {
    flex: 1;
  }

  :global(.modal-alert) {
    margin: 0;
  }
</style>
