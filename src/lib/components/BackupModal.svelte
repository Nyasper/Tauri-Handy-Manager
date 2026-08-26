<script lang="ts">
  import { handyDB } from '$lib/services/db.service.svelte';
  import { save, open } from '@tauri-apps/plugin-dialog';
  import AppModal from './AppModal.svelte';
  import Alert from './Alert.svelte';
  import { createFeedback } from '$lib/utils/feedback.svelte';
  import { todayISO } from '$lib/utils/dates';

  let { onclose }: { onclose: () => void } = $props();

  let busy = $state<'backup' | 'restore' | null>(null);
  const feedback = createFeedback();
  let confirmRestorePath = $state<string | null>(null);

  async function handleBackup() {
    feedback.clear();
    let path: string | null;
    try {
      path = await save({
        title: 'Guardar copia de seguridad',
        defaultPath: `handy-manager-${todayISO()}.db`,
        filters: [{ name: 'Base de datos SQLite', extensions: ['db'] }],
      });
    } catch (err: any) {
      feedback.setError(err.message || 'Error al elegir el archivo de destino');
      return;
    }
    if (!path) return;
    busy = 'backup';
    try {
      await handyDB.backupDatabase(path);
      feedback.setSuccess('Copia de seguridad creada con éxito');
    } catch (err: any) {
      feedback.setError(err.message || 'Error al crear la copia de seguridad');
    } finally {
      busy = null;
    }
  }

  async function handleRestore() {
    feedback.clear();
    let path: string | string[] | null;
    try {
      path = await open({
        title: 'Seleccionar copia de seguridad',
        multiple: false,
        filters: [{ name: 'Base de datos SQLite', extensions: ['db'] }],
      });
    } catch (err: any) {
      feedback.setError(err.message || 'Error al elegir el archivo de copia');
      return;
    }
    if (!path) return;
    confirmRestorePath = String(path);
  }

  async function confirmRestore() {
    if (!confirmRestorePath) return;
    feedback.clear();
    busy = 'restore';
    try {
      await handyDB.restoreDatabase(confirmRestorePath);
      feedback.setSuccess('Datos restaurados correctamente');
    } catch (err: any) {
      feedback.setError(err.message || 'Error al restaurar los datos');
    } finally {
      busy = null;
      confirmRestorePath = null;
    }
  }

  function fileName(path: string): string {
    return path.split(/[\\/]/).pop() ?? path;
  }
</script>

<AppModal title="Copia de seguridad" maxWidth="520px" {onclose}>
  <div class="modal-body">
    <section class="backup-card">
      <div class="card-icon success">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </div>
      <div class="card-content">
        <h4>Crear copia de seguridad</h4>
        <p>Guarda una copia completa de la base de datos en el archivo que elijas.</p>
        <button
          type="button"
          class="btn-primary"
          onclick={handleBackup}
          disabled={busy !== null}
        >
          {busy === 'backup' ? 'Creando copia...' : 'Crear copia'}
        </button>
      </div>
    </section>

    <section class="backup-card">
      <div class="card-icon danger">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
          <polyline points="3 3 3 8 8 8"></polyline>
        </svg>
      </div>
      <div class="card-content">
        <h4>Restaurar copia de seguridad</h4>
        <p>Reemplaza los datos actuales con el contenido de una copia anterior.</p>
        {#if confirmRestorePath}
          <div class="confirm-box">
            <div class="confirm-file">
              Se restaurará <strong>{fileName(confirmRestorePath)}</strong> y se
              <strong>reemplazarán los datos actuales</strong>.
            </div>
            <div class="confirm-actions">
              <button
                type="button"
                class="btn-secondary"
                onclick={() => (confirmRestorePath = null)}
                disabled={busy !== null}
              >
                Cancelar
              </button>
              <button
                type="button"
                class="btn-danger"
                onclick={confirmRestore}
                disabled={busy !== null}
              >
                {busy === 'restore' ? 'Restaurando...' : 'Restaurar'}
              </button>
            </div>
          </div>
        {:else}
          <button
            type="button"
            class="btn-secondary"
            onclick={handleRestore}
            disabled={busy !== null}
          >
            Elegir archivo...
          </button>
        {/if}
      </div>
    </section>

    {#if feedback.error}
      <Alert type="danger" class="modal-alert" onclick={feedback.clear}>{feedback.error}</Alert>
    {/if}
    {#if feedback.success}
      <Alert type="success" class="modal-alert" onclick={feedback.clear}>{feedback.success}</Alert>
    {/if}
  </div>
</AppModal>

<style>
  .modal-body {
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .backup-card {
    display: flex;
    gap: 16px;
    padding: 18px;
    background: var(--surface-subtle);
    border: 1px solid var(--border-1);
    border-radius: var(--radius-md);
  }

  .card-icon {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-icon svg {
    width: 20px;
    height: 20px;
  }

  .card-icon.success {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: var(--color-success);
  }

  .card-icon.danger {
    background: rgba(244, 63, 94, 0.08);
    border: 1px solid rgba(244, 63, 94, 0.2);
    color: var(--color-danger);
  }

  .card-content {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    min-width: 0;
  }

  .card-content h4 {
    font-size: 1rem;
    color: var(--text-primary);
  }

  .card-content p {
    font-size: 0.85rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin-bottom: 6px;
  }

  .card-content button {
    padding: 10px 20px;
    font-size: 0.88rem;
  }

  .confirm-box {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    background: rgba(244, 63, 94, 0.05);
    border: 1px solid rgba(244, 63, 94, 0.2);
    border-radius: var(--radius-sm);
  }

  .confirm-file {
    font-size: 0.85rem;
    color: var(--text-primary);
    line-height: 1.5;
    word-break: break-word;
  }

  .confirm-file strong {
    color: var(--color-danger);
  }

  .confirm-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  :global(.modal-alert) {
    margin: 0;
  }

  @media (max-width: 480px) {
    .modal-body {
      padding: 14px 16px;
    }

    .backup-card {
      flex-direction: column;
      align-items: flex-start;
    }

    .card-content {
      width: 100%;
    }

    .card-content button {
      width: 100%;
      justify-content: center;
    }
  }
</style>
