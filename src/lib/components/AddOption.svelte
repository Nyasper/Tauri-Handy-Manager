<script lang="ts">
  let {
    label,
    text,
    onclick,
    suffix,
  }: {
    label: string;
    text: string;
    onclick: () => void;
    suffix?: string;
  } = $props();
</script>

<button type="button" class="add-option" {onclick}>
  <span class="add-plus">+</span>
  <span class="add-text">{label} <strong>{text}</strong>{#if suffix}<span class="add-suffix">{suffix}</span>{/if}</span>
</button>

<style>
  .add-option {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 12px 14px;
    background: var(--surface-1);
    border: 1px dashed var(--color-accent-border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: var(--font-header);
    font-weight: 500;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .add-plus {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--color-accent);
    color: var(--accent-contrast);
    font-size: 0.95rem;
    font-weight: 700;
    flex-shrink: 0;
  }
</style>
