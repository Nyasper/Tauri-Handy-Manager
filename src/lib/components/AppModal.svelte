<script lang="ts">
  import type { Snippet } from 'svelte';
  import { shortcuts } from '$lib/services/shortcuts.service.svelte';

  let {
    title,
    onclose,
    onconfirm,
    maxWidth = '560px',
    children,
  }: {
    title: string;
    onclose: () => void;
    onconfirm?: () => void;
    maxWidth?: string;
    children: Snippet;
  } = $props();

  let panelEl = $state<HTMLElement | null>(null);

  // Register this modal as the active dismiss/confirm layer for keyboard shortcuts
  $effect(() => {
    const unregister = shortcuts.pushModal({
      dismiss: onclose,
      confirm: onconfirm,
      scope: panelEl,
    });
    return unregister;
  });
</script>

<div
  class="modal-overlay"
  role="presentation"
  onclick={(e) => e.target === e.currentTarget && onclose()}
>
  <div class="modal-panel glass-panel" style={`max-width: ${maxWidth}`} bind:this={panelEl}>
    <div class="modal-header">
      <h3>{title}</h3>
      <button class="close-btn" onclick={onclose} title="Cerrar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    {@render children()}
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 20px;
  }

  .modal-panel {
    width: 100%;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: var(--radius-lg);
    background: rgba(13, 14, 18, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: var(--shadow-pop);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 20px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .modal-header h3 {
    font-size: 1.2rem;
    color: #fff;
    min-width: 0;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
  }

  @media (max-width: 768px) {
    .modal-overlay {
      padding: 12px;
    }
  }

  @media (max-width: 480px) {
    .modal-overlay {
      padding: 0;
      align-items: flex-end;
    }

    .modal-panel {
      max-height: 92dvh;
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      border-bottom: none;
    }

    .modal-header {
      padding: 14px 16px;
    }
  }
</style>
