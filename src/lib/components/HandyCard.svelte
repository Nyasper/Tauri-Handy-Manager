<script lang="ts">
  import type { Handy } from '$lib/services/db.service.svelte';
  import { shortcuts } from '$lib/services/shortcuts.service.svelte';

  let {
    handy,
    pinned = false,
    onassign,
    onpin,
    onarea,
    oncontextmenu,
  }: {
    handy: Handy;
    pinned?: boolean;
    onassign: () => void;
    onpin: () => void;
    onarea: (ownerId: number) => void;
    oncontextmenu: (e: MouseEvent) => void;
  } = $props();
</script>

<div class="handy-card-wrap" class:pinned={pinned}>
  {#if handy.owner_id !== null}
    <button
      type="button"
      class="pin-btn"
      class:active={pinned}
      title={pinned ? 'Desfijar' : 'Fijar'}
      onclick={onpin}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 17v5"></path>
        <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"></path>
      </svg>
    </button>
  {/if}

  <button
    type="button"
    class="handy-card glass-panel"
    class:assigned={handy.owner_id !== null}
    {@attach shortcuts.rovingFocus('grid')}
    onclick={onassign}
    oncontextmenu={oncontextmenu}
  >
    <div class="handy-badge">
      <span class="handy-number">{handy.id}</span>
    </div>

    <div class="handy-info">
      <span class="handy-title">Handy {handy.id}</span>
      {#if handy.owner_name}
        <span class="handy-status text-success" title={handy.owner_name}>
          {handy.owner_name}
        </span>
      {:else}
        <span class="handy-status text-muted">Libre</span>
      {/if}
    </div>

    <!-- Glowing indicator dot -->
    <div class="indicator-dot"></div>
  </button>

  {#if handy.owner_id != null && handy.area_name}
    {const ownerId = handy.owner_id}
    <button
      type="button"
      class="area-badge-btn"
      title={`Cambiar área de ${handy.owner_name}`}
      onclick={() => onarea(ownerId)}
    >
      <span class="area-dot"></span>
      <span class="area-label">{handy.area_name}</span>
    </button>
  {/if}
</div>

<style>
  .handy-card-wrap {
    position: relative;
    min-width: 0;
  }

  .handy-card {
    appearance: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 14px 10px 16px;
    text-align: center;
    gap: 8px;
    cursor: pointer;
    position: relative;
    border-radius: var(--radius-md);
    user-select: none;
    overflow: hidden;
    height: 160px;
    color: inherit;
    font-family: inherit;
    font-size: inherit;
  }

  .handy-card-wrap.pinned .handy-card {
    border-color: rgba(245, 158, 11, 0.5);
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.09), var(--pinned-fade));
  }

  .handy-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--border-1);
  }

  .handy-card:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .pin-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-1);
    border: 1px solid var(--border-1);
    border-radius: 50%;
    color: var(--text-muted);
    cursor: pointer;
    z-index: 2;
    transition: all var(--transition-fast);
  }

  .pin-btn svg {
    width: 14px;
    height: 14px;
  }

  .pin-btn:hover {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.5);
    color: #fbbf24;
  }

  .pin-btn.active {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.5);
    color: #fbbf24;
  }

  .area-badge-btn {
    position: absolute;
    bottom: 6px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 5px;
    max-width: calc(100% - 12px);
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--surface-1);
    border: 1px solid var(--border-2);
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 0.65rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: all var(--transition-fast);
  }

  .area-badge-btn:hover {
    background: var(--surface-hover);
    border-color: var(--color-accent-border);
    color: var(--color-accent);
  }

  .area-badge-btn:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .area-badge-btn .area-dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-accent);
  }

  .area-badge-btn .area-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .handy-badge {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--surface-1);
    border: 1px solid var(--border-2);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all var(--transition-fast);
  }

  .handy-card.assigned .handy-badge {
    border-color: var(--color-success);
    background: rgba(16, 185, 129, 0.1);
  }

  .handy-number {
    font-family: var(--font-header);
    font-size: 1.05rem;
    font-weight: 700;
  }

  .handy-card.assigned .handy-number {
    color: var(--color-success);
  }

  .handy-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .handy-title {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .handy-status {
    font-size: 0.75rem;
    font-weight: 500;
    white-space: normal;
    word-break: break-word;
    display: block;
    width: 100%;
  }

  .text-success {
    color: var(--color-success);
  }

  .text-muted {
    color: var(--text-muted);
  }

  .indicator-dot {
    position: absolute;
    top: 12px;
    left: 12px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-muted);
  }

  .handy-card.assigned .indicator-dot {
    background: var(--color-success);
    box-shadow: 0 0 8px var(--color-success);
  }

  @media (max-width: 480px) {
    .handy-badge {
      width: 36px;
      height: 36px;
    }

    .handy-number {
      font-size: 0.95rem;
    }
  }
</style>
