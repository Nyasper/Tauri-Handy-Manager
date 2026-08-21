<script lang="ts">
  import { onMount } from 'svelte';
  import { handyDB } from '$lib/services/db.service.svelte';
  import AppModal from './AppModal.svelte';
  import Alert from './Alert.svelte';
  import { modalService } from '$lib/services/modal.service.svelte';

  let { onclose }: { onclose: () => void } = $props();

  let password = $state('');
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let changingPassword = $state(false);
  let passwordSet = $state(false);
  let recentCount = $state('');
  let oldestCount = $state('');
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);

  onMount(async () => {
    try {
      const pw = await handyDB.getSecurityPassword();
      passwordSet = pw != null && pw !== '';
    } catch {
      passwordSet = false;
    }
  });

  function clearFeedback() {
    error = null;
    success = null;
  }

  function parseCount(value: string): number {
    const n = parseInt(value, 10);
    if (!Number.isInteger(n) || n <= 0) return NaN;
    return n;
  }

  async function savePassword() {
    clearFeedback();

    if (changingPassword) {
      const stored = await handyDB.getSecurityPassword();
      if (!stored) {
        passwordSet = false;
        error = 'Primero debes configurar una contraseña de seguridad';
        return;
      }
      if (currentPassword !== stored) {
        error = 'La contraseña actual es incorrecta';
        return;
      }
      const pw = newPassword.trim();
      if (!pw) {
        error = 'La contraseña no puede estar vacía';
        return;
      }
      if (pw !== confirmPassword) {
        error = 'La confirmación de la nueva contraseña no coincide';
        return;
      }
      try {
        await handyDB.setSecurityPassword(pw);
        currentPassword = '';
        newPassword = '';
        confirmPassword = '';
        changingPassword = false;
        passwordSet = true;
        success = 'Contraseña actualizada con éxito';
      } catch (err: any) {
        error = err.message || 'Error al actualizar la contraseña';
      }
      return;
    }

    const pw = password.trim();
    if (!pw) {
      error = 'La contraseña no puede estar vacía';
      return;
    }
    try {
      await handyDB.setSecurityPassword(pw);
      password = '';
      changingPassword = false;
      passwordSet = true;
      success = 'Contraseña guardada con éxito';
    } catch (err: any) {
      error = err.message || 'Error al guardar la contraseña';
    }
  }

  async function checkPassword(): Promise<boolean> {
    const stored = await handyDB.getSecurityPassword();
    if (!stored) {
      passwordSet = false;
      error = 'Primero debes configurar una contraseña de seguridad';
      return false;
    }
    if (password !== stored) {
      error = 'Contraseña incorrecta';
      return false;
    }
    return true;
  }

  async function handleDeleteRecent() {
    clearFeedback();
    const n = parseCount(recentCount);
    if (Number.isNaN(n)) {
      error = 'Ingresa un número de entradas mayor que 0';
      return;
    }
    const confirmed = await modalService.confirm({
      title: 'Borrar recientes',
      message: `¿Borrar las ${n} entradas más recientes del historial? Esta acción no se puede deshacer.`,
      confirmLabel: 'Borrar',
      danger: true,
    });
    if (!confirmed) return;
    if (!(await checkPassword())) return;

    try {
      const total = handyDB.history.length;
      const deleted = Math.min(n, total);
      await handyDB.deleteRecentHistory(n);
      recentCount = '';
      success = `Se borraron ${deleted} entrada${deleted === 1 ? '' : 's'} más reciente${deleted === 1 ? '' : 's'}`;
    } catch (err: any) {
      error = err.message || 'Error al borrar las entradas';
    }
  }

  async function handleDeleteOldest() {
    clearFeedback();
    const n = parseCount(oldestCount);
    if (Number.isNaN(n)) {
      error = 'Ingresa un número de entradas mayor que 0';
      return;
    }
    const confirmed = await modalService.confirm({
      title: 'Borrar antiguas',
      message: `¿Borrar las ${n} entradas más antiguas del historial? Esta acción no se puede deshacer.`,
      confirmLabel: 'Borrar',
      danger: true,
    });
    if (!confirmed) return;
    if (!(await checkPassword())) return;

    try {
      const total = handyDB.history.length;
      const deleted = Math.min(n, total);
      await handyDB.deleteOldestHistory(n);
      oldestCount = '';
      success = `Se borraron ${deleted} entrada${deleted === 1 ? '' : 's'} más antigua${deleted === 1 ? '' : 's'}`;
    } catch (err: any) {
      error = err.message || 'Error al borrar las entradas';
    }
  }

  async function handleDeleteAll() {
    clearFeedback();
    const confirmed = await modalService.confirm({
      title: 'Borrar todo el historial',
      message: `¿Borrar TODO el historial (${handyDB.history.length} entradas)? Esta acción no se puede deshacer.`,
      confirmLabel: 'Borrar todo',
      danger: true,
    });
    if (!confirmed) return;
    if (!(await checkPassword())) return;

    try {
      await handyDB.clearHistory();
      success = 'Se borró todo el historial';
    } catch (err: any) {
      error = err.message || 'Error al borrar el historial';
    }
  }
</script>

<AppModal title="Eliminar historial" {onclose}>
  <div class="modal-body">
    <section class="security-panel">
      <h4>Contraseña de seguridad</h4>
      {#if !passwordSet}
        <p class="hint">Configurá una contraseña para poder borrar el historial.</p>
        <div class="security-row">
          <input
            type="password"
            bind:value={password}
            placeholder="Nueva contraseña"
            autocomplete="new-password"
          />
          <button type="button" class="btn-primary btn-sm" onclick={savePassword}>
            Guardar contraseña
          </button>
        </div>
      {:else if !changingPassword}
        <p class="hint">Contraseña configurada. Escribila para confirmar los borrados.</p>
        <div class="security-row">
          <input
            type="password"
            bind:value={password}
            placeholder="Contraseña de seguridad"
            autocomplete="current-password"
          />
          <button
            type="button"
            class="btn-secondary btn-sm"
            onclick={() => {
              changingPassword = true;
              currentPassword = '';
              newPassword = '';
              confirmPassword = '';
              clearFeedback();
            }}
          >
            Cambiar
          </button>
        </div>
      {:else}
        <p class="hint">Ingresá la contraseña actual y la nueva contraseña.</p>
        <div class="security-column">
          <input
            type="password"
            bind:value={currentPassword}
            placeholder="Contraseña actual"
            autocomplete="current-password"
          />
          <input
            type="password"
            bind:value={newPassword}
            placeholder="Nueva contraseña"
            autocomplete="new-password"
          />
          <input
            type="password"
            bind:value={confirmPassword}
            placeholder="Confirmar nueva contraseña"
            autocomplete="new-password"
          />
          <div class="security-row">
            <button type="button" class="btn-primary btn-sm" onclick={savePassword}>
              Guardar nueva
            </button>
            <button
              type="button"
              class="btn-secondary btn-sm"
              onclick={() => {
                changingPassword = false;
                currentPassword = '';
                newPassword = '';
                confirmPassword = '';
                clearFeedback();
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      {/if}
    </section>

    <section class="options-list">
      <div class="option-item">
        <div class="option-info">
          <span class="option-title">Borrar recientes</span>
          <span class="option-desc">Elimina las entradas más nuevas del historial</span>
        </div>
        <div class="option-controls">
          <input
            type="number"
            min="1"
            step="1"
            bind:value={recentCount}
            placeholder="N"
            aria-label="Cantidad de entradas recientes"
          />
          <button type="button" class="btn-danger btn-sm" onclick={handleDeleteRecent}>
            Borrar
          </button>
        </div>
      </div>

      <div class="option-item">
        <div class="option-info">
          <span class="option-title">Borrar antiguas</span>
          <span class="option-desc">Elimina las entradas más antiguas del historial</span>
        </div>
        <div class="option-controls">
          <input
            type="number"
            min="1"
            step="1"
            bind:value={oldestCount}
            placeholder="N"
            aria-label="Cantidad de entradas antiguas"
          />
          <button type="button" class="btn-danger btn-sm" onclick={handleDeleteOldest}>
            Borrar
          </button>
        </div>
      </div>

      <div class="option-item">
        <div class="option-info">
          <span class="option-title">Borrar todo el historial</span>
          <span class="option-desc">Elimina todas las entradas registradas</span>
        </div>
        <button type="button" class="btn-danger btn-sm" onclick={handleDeleteAll}>
          Borrar todo
        </button>
      </div>
    </section>

    {#if error}
      <Alert type="danger" icon={false} class="modal-alert">{error}</Alert>
    {/if}
    {#if success}
      <Alert type="success" icon={false} class="modal-alert">{success}</Alert>
    {/if}
  </div>
</AppModal>

<style>
  .modal-body {
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .security-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-sm);
  }

  .security-panel h4 {
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .hint {
    font-size: 0.8rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .security-row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .security-row input {
    flex: 1;
    min-width: 160px;
  }

  .security-column {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .security-column .security-row {
    padding-top: 2px;
  }

  .options-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .option-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-sm);
  }

  .option-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .option-title {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .option-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .option-controls {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .option-controls input {
    width: 80px;
  }

  .btn-sm {
    padding: 6px 12px;
    font-size: 0.8rem;
    border-radius: var(--radius-sm);
  }

  :global(.modal-alert) {
    margin: 0;
  }

  @media (max-width: 480px) {
    .modal-body {
      padding: 14px 16px;
    }

    .option-item {
      flex-direction: column;
      align-items: stretch;
    }

    .option-controls {
      justify-content: space-between;
    }

    .option-controls input {
      flex: 1;
    }
  }
</style>
