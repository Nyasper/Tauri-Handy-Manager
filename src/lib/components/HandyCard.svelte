<script lang="ts">
  import type { Handy } from '$lib/db.svelte';

  let {
    handy,
    pinned = false,
    onassign,
    onpin,
    oncontextmenu,
  }: {
    handy: Handy;
    pinned?: boolean;
    onassign: () => void;
    onpin: () => void;
    oncontextmenu: (e: MouseEvent) => void;
  } = $props();
</script>

<div
  class="handy-card glass-panel"
  class:assigned={handy.owner_id !== null}
  class:pinned={pinned}
  role="button"
  tabindex="0"
  onclick={onassign}
  oncontextmenu={oncontextmenu}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onassign();
    }
  }}
>
  {#if handy.owner_id !== null}
    <button
      type="button"
      class="pin-btn"
      class:active={pinned}
      title={pinned ? 'Desfijar' : 'Fijar'}
      onclick={(e) => {
        e.stopPropagation();
        onpin();
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 17v5"></path>
        <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"></path>
      </svg>
    </button>
  {/if}

  <div class="handy-badge">
    <span class="handy-number">{handy.id}</span>
  </div>

  <div class="handy-info">
    <span class="handy-title">Handy {handy.id}</span>
    {#if handy.owner_name}
      <span class="handy-status text-success" title={handy.owner_name}>
        {handy.owner_name}
      </span>
      {#if handy.area_name}
        <span class="handy-area text-muted" title={handy.area_name}>
          {handy.area_name}
        </span>
      {/if}
    {:else}
      <span class="handy-status text-muted">Libre</span>
    {/if}
  </div>

  <!-- Glowing indicator dot -->
  <div class="indicator-dot"></div>
</div>

<style>
  .handy-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 14px 10px 16px;
    text-align: center;
    gap: 8px;
    cursor: pointer;
    position: relative;
    border-radius: var(--radius-md);
    user-select: none;
    overflow: hidden;
    height: 160px;
  }

  .handy-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
  }

  .handy-card:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .handy-card.pinned {
    border-color: rgba(245, 158, 11, 0.5);
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.09), rgba(8, 8, 10, 0.5));
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
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
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

  .handy-badge {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
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

  .handy-area {
    font-size: 0.7rem;
    font-weight: 400;
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
