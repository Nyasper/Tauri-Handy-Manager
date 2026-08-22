<script lang="ts">
  import type { Handy } from '$lib/services/db.service.svelte';
  import HandyCard from './HandyCard.svelte';

  let {
    handies,
    onassign,
    onpin,
    oncontextmenu,
  }: {
    handies: Handy[];
    onassign: (id: number) => void;
    onpin: (id: number) => void;
    oncontextmenu: (e: MouseEvent, handy: Handy) => void;
  } = $props();
</script>

{#if handies.length > 0}
  <div class="handies-grid">
    {#each handies as handy (handy.id)}
      <HandyCard
        handy={handy}
        pinned={handy.fixed}
        onassign={() => onassign(handy.id)}
        onpin={() => onpin(handy.id)}
        oncontextmenu={(e) => oncontextmenu(e, handy)}
      />
    {/each}
  </div>
{/if}

<style>
  .handies-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    grid-auto-rows: auto;
    gap: 12px;
  }

  @media (max-width: 768px) {
    .handies-grid {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 10px;
    }
  }

  @media (max-width: 480px) {
    .handies-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 8px;
    }
  }
</style>
