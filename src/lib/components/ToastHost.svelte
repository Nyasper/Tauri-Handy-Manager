<script lang="ts">
  import Alert from './Alert.svelte';
  import { toastService } from '$lib/services/toast.service.svelte';
</script>

{#if toastService.toasts.length > 0}
  <div class="toast-container" role="status" aria-live="polite">
    {#each toastService.toasts as toast (toast.id)}
      <button
        type="button"
        class="toast-item"
        onclick={() => toastService.dismiss(toast.id)}
      >
        <Alert type={toast.kind} icon={true} class="toast-alert">{toast.message}</Alert>
      </button>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    bottom: 22px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 300;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: min(92vw, 440px);
    pointer-events: none;
  }

  .toast-item {
    pointer-events: auto;
    width: 100%;
    appearance: none;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    animation: toast-in 0.22s ease;
  }

  /* Clickable to close, but without the app-wide hover ring */
  .toast-item:hover {
    outline: none;
  }

  :global(.toast-alert) {
    margin: 0;
    box-shadow: var(--shadow-pop);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
