<script lang="ts">
  import AppModal from './AppModal.svelte';
  import { modalService } from '$lib/services/modal.service.svelte';

  let promptValue = $state('');
  let promptInput = $state<HTMLInputElement | null>(null);

  // Reset the prompt value and focus the field each time a prompt opens
  $effect(() => {
    if (modalService.state?.kind === 'prompt') {
      promptValue = modalService.state.defaultValue;
    }
  });

  $effect(() => {
    if (modalService.state?.kind === 'prompt' && promptInput) {
      promptInput.focus();
      promptInput.select();
    }
  });

  function cancel() {
    modalService.resolve(modalService.state?.kind === 'prompt' ? null : false);
  }

  function handleConfirm() {
    const state = modalService.state;
    if (!state) return;
    modalService.resolve(state.kind === 'prompt' ? promptValue : true);
  }
</script>

{#if modalService.state}
  <AppModal title={modalService.state.title} onclose={cancel} onconfirm={handleConfirm} maxWidth="420px">
    <div class="modal-body">
      <p class="modal-message">{modalService.state.message}</p>

      {#key modalService.state}
        {#if modalService.state.kind === 'prompt'}
          <input
            bind:this={promptInput}
            bind:value={promptValue}
            type="text"
            autocomplete="off"
            onkeydown={(e) => {
              if (e.key === 'Enter') handleConfirm();
            }}
          />
        {/if}
      {/key}

      <div class="modal-actions">
        {#if modalService.state.kind === 'confirm' || modalService.state.kind === 'prompt'}
          <button type="button" class="btn-secondary" onclick={cancel}>
            {modalService.state.cancelLabel ?? 'Cancelar'}
          </button>
        {/if}
        <button
          type="button"
          class={modalService.state.kind === 'confirm' && modalService.state.danger ? 'btn-danger' : 'btn-primary'}
          onclick={handleConfirm}
        >
          {modalService.state.confirmLabel}
        </button>
      </div>
    </div>
  </AppModal>
{/if}

<style>
  .modal-body {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .modal-message {
    font-size: 0.95rem;
    line-height: 1.6;
    color: var(--text-secondary);
    white-space: pre-line;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .modal-actions button {
    min-width: 120px;
  }

  @media (max-width: 480px) {
    .modal-body {
      padding: 16px;
    }

    .modal-actions button {
      flex: 1;
      min-width: 0;
    }
  }

  @media (max-width: 360px) {
    .modal-actions {
      flex-direction: column;
    }
  }
</style>
