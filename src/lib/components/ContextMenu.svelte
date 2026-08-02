<script lang="ts">
  import { contextMenu } from '$lib/services/context-menu.service.svelte';

  let menuEl = $state<HTMLDivElement | null>(null);
  let stylePos = $state({ left: 0, top: 0 });

  // Position the menu at the click point and clamp it inside the viewport
  $effect(() => {
    if (!contextMenu.isOpen) return;
    stylePos = { left: contextMenu.position.x, top: contextMenu.position.y };

    requestAnimationFrame(() => {
      if (!contextMenu.isOpen || !menuEl) return;
      const rect = menuEl.getBoundingClientRect();
      let { left, top } = stylePos;
      const margin = 8;
      if (left + rect.width + margin > window.innerWidth) {
        left = Math.max(margin, window.innerWidth - rect.width - margin);
      }
      if (top + rect.height + margin > window.innerHeight) {
        top = Math.max(margin, window.innerHeight - rect.height - margin);
      }
      stylePos = { left, top };
    });
  });

  // Close the menu with the Escape key
  $effect(() => {
    if (!contextMenu.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') contextMenu.close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Focus the first item when the menu opens
  $effect(() => {
    if (!contextMenu.isOpen) return;
    const items = menuEl?.querySelectorAll<HTMLButtonElement>('.cm-item:not(.disabled)');
    items?.[0]?.focus();
  });

  function handleMenuKeydown(e: KeyboardEvent) {
    const items = Array.from(
      menuEl?.querySelectorAll<HTMLButtonElement>('.cm-item:not(.disabled)') ?? [],
    );
    if (items.length === 0) return;
    const idx = Math.max(
      0,
      items.indexOf(document.activeElement as HTMLButtonElement),
    );
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      items[(idx + delta + items.length) % items.length].focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      (e.key === 'Home' ? items[0] : items[items.length - 1]).focus();
    }
  }
</script>

{#if contextMenu.isOpen}
  <div
    bind:this={menuEl}
    class="context-menu"
    style={`left: ${stylePos.left}px; top: ${stylePos.top}px;`}
    role="menu"
    tabindex="-1"
    onkeydown={handleMenuKeydown}
    oncontextmenu={(e) => e.preventDefault()}
  >
    {#each contextMenu.items as item (item)}
      {#if item.isSeparator}
        <div class="cm-separator" role="separator"></div>
      {:else}
        <button
          type="button"
          class="cm-item"
          class:disabled={item.disabled}
          role="menuitem"
          tabindex="-1"
          onclick={() => {
            if (item.disabled) return;
            contextMenu.close();
            item.action();
          }}
        >
          {#if item.icon}
            <span class="cm-icon">{item.icon}</span>
          {/if}
          <span class="cm-label">{item.label}</span>
          {#if item.shortcut}
            <span class="cm-shortcut">{item.shortcut}</span>
          {/if}
        </button>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .context-menu {
    position: fixed;
    z-index: 200;
    min-width: 200px;
    max-width: 280px;
    padding: 6px;
    background: rgba(13, 14, 18, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-pop);
    backdrop-filter: blur(24px) saturate(140%);
    -webkit-backdrop-filter: blur(24px) saturate(140%);
    font-family: var(--font-body);
    font-size: 0.85rem;
    animation: fadeIn var(--transition-fast) forwards;
  }

  .cm-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-primary);
    text-align: left;
    font-family: inherit;
    font-size: inherit;
    cursor: pointer;
  }

  .cm-item:active:not(:disabled) {
    background: rgba(255, 255, 255, 0.14);
  }

  .cm-item:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .cm-icon {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .cm-label {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cm-shortcut {
    margin-left: auto;
    color: var(--text-muted);
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .cm-separator {
    height: 1px;
    margin: 5px 8px;
    background: rgba(255, 255, 255, 0.1);
  }
</style>
