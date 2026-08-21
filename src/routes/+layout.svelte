<script lang="ts">
  import { handyDB } from '$lib/services/db.service.svelte';
  import ContextMenu from '$lib/components/ContextMenu.svelte';
  import ModalHost from '$lib/components/ModalHost.svelte';
  import '../app.css';

  let { children } = $props();

  // Suppress the native browser/WebView context menu app-wide
  $effect(() => {
    const prevent = (e: Event) => e.preventDefault();
    window.addEventListener('contextmenu', prevent, true);
    return () => window.removeEventListener('contextmenu', prevent, true);
  });
</script>

{#if handyDB.loading}
  <div class="loading-screen">
    <div class="spinner"></div>
    <p>Iniciando base de datos...</p>
  </div>
{:else if handyDB.error}
  <div class="error-screen animate-fade">
    <h2>Error de Conexión</h2>
    <p>{handyDB.error}</p>
    <button class="btn-primary" onclick={() => handyDB.initDb()}>Reintentar</button>
  </div>
{:else}
  {@render children()}
{/if}

<ContextMenu />
<ModalHost />

<style>
  .loading-screen, .error-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 16px;
    font-family: var(--font-header);
    background-color: var(--bg-main);
    background-image: radial-gradient(ellipse 85% 55% at 50% -12%, var(--bg-glow-loading), transparent 60%);
    background-attachment: fixed;
  }

  .spinner {
    width: 50px;
    height: 50px;
    border: 3px solid var(--spinner-track);
    border-radius: 50%;
    border-top-color: var(--color-accent);
    animation: spin 1s ease-in-out infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-screen h2 {
    color: var(--color-danger);
    font-size: 1.8rem;
  }

  .error-screen p {
    color: var(--text-secondary);
    max-width: 400px;
    text-align: center;
  }

  @media (max-width: 480px) {
    .loading-screen, .error-screen {
      padding: 20px;
    }

    .error-screen h2 {
      font-size: 1.4rem;
    }

    .error-screen p {
      font-size: 0.9rem;
    }
  }
</style>
