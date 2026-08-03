<script lang="ts">
  import { shortcuts } from '$lib/services/shortcuts.service.svelte';

  let {
    value = $bindable(''),
    placeholder = 'Buscar...',
    id,
    navZone,
    class: className = '',
  }: {
    value: string;
    placeholder?: string;
    id?: string;
    navZone?: 'header' | 'search' | 'grid';
    class?: string;
  } = $props();
</script>

<div class={`search-group ${className}`.trim()}>
  <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
  <input {id} type="text" bind:value {placeholder} autocomplete="off" {@attach shortcuts.rovingFocus(navZone)} />
</div>

<style>
  .search-group {
    position: relative;
  }

  .search-icon {
    position: absolute;
    top: 50%;
    left: 14px;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    color: var(--text-muted);
    pointer-events: none;
  }

  .search-group input {
    padding-left: 40px;
  }
</style>
