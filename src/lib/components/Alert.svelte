<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    type,
    icon = true,
    class: className = '',
    onclick,
    children,
  }: {
    type: 'danger' | 'success';
    icon?: boolean;
    class?: string;
    onclick?: () => void;
    children: Snippet;
  } = $props();
</script>

<!-- When clickable the root is a <button> (a11y-safe); the linter can't see the dynamic tag -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:element
  this={onclick ? 'button' : 'div'}
  type={onclick ? 'button' : undefined}
  class="alert {className}"
  class:alert-danger={type === 'danger'}
  class:alert-success={type === 'success'}
  {onclick}
>
  {#if icon}
    {#if type === 'danger'}
      <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    {:else}
      <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    {/if}
  {/if}
  <span>{@render children()}</span>
</svelte:element>

<style>
  .alert {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    line-height: 1.5;
  }

  /* Clickable variant: reset button defaults and remove the app-wide hover ring */
  button.alert {
    appearance: none;
    width: 100%;
    text-align: left;
    font-family: var(--font-body);
    font-size: inherit;
    cursor: pointer;
  }

  button.alert:hover {
    outline: none;
  }

  .alert-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .alert-danger {
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.15);
    color: #fca5a5;
  }

  .alert-success {
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.15);
    color: #a7f3d0;
  }
</style>
