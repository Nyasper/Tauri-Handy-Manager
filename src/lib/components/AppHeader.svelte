<script lang="ts">
  import { shortcuts } from '$lib/services/shortcuts.service.svelte';

  let {
    totalCount,
    assignedCount,
    freeCount,
    activeFilter,
    onfilter,
    onfuncionarios,
    onhistorial,
    onbackup,
  }: {
    totalCount: number;
    assignedCount: number;
    freeCount: number;
    activeFilter: 'all' | 'assigned' | 'free';
    onfilter: (filter: 'assigned' | 'free') => void;
    onfuncionarios: () => void;
    onhistorial: () => void;
    onbackup: () => void;
  } = $props();
</script>

<header class="app-header glass-panel">
  <div class="brand">
    <svg class="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 18l.01 0"></path>
      <path d="M9.172 15.172a4 4 0 0 1 5.656 0"></path>
      <path d="M6.343 12.343a8 8 0 0 1 11.314 0"></path>
      <path d="M3.515 9.515c4.686 -4.687 12.284 -4.687 17 0"></path>
    </svg>
    <h1>HANDY MANAGER</h1>
  </div>
  <div class="stats-bar">
    <div class="stat-badge">
      <span class="stat-label">Total</span>
      <span class="stat-value">{totalCount}</span>
    </div>
    <button
      type="button"
      class="stat-badge success"
      class:active={activeFilter === 'assigned'}
      {@attach shortcuts.rovingFocus('header')}
      onclick={() => onfilter('assigned')}
      title={activeFilter === 'assigned' ? 'Mostrar todos' : 'Filtrar asignados'}
    >
      <span class="stat-label">Asignados</span>
      <span class="stat-value">{assignedCount}</span>
    </button>
    <button
      type="button"
      class="stat-badge info"
      class:active={activeFilter === 'free'}
      {@attach shortcuts.rovingFocus('header')}
      onclick={() => onfilter('free')}
      title={activeFilter === 'free' ? 'Mostrar todos' : 'Filtrar libres'}
    >
      <span class="stat-label">Libres</span>
      <span class="stat-value">{freeCount}</span>
    </button>
    <button class="btn-secondary manage-btn" {@attach shortcuts.rovingFocus('header')} onclick={onhistorial}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      Historial
    </button>
    <button class="btn-secondary manage-btn" {@attach shortcuts.rovingFocus('header')} onclick={onfuncionarios}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
      Administración
    </button>
    <button type="button" class="btn-secondary manage-btn backup-btn" {@attach shortcuts.rovingFocus('header')} onclick={onbackup} title="Crear o restaurar copias de seguridad">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      Copia de seguridad
    </button>
  </div>
</header>

<style>
  .app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 18px 30px;
    border-radius: var(--radius-lg);
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
    box-shadow: var(--shadow-panel);
    flex-shrink: 0;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .brand h1 {
    font-size: 1.5rem;
    letter-spacing: 0.1em;
    background: linear-gradient(to right, #ffffff, var(--text-secondary));
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .brand-icon {
    width: 30px;
    height: 30px;
    color: var(--color-accent);
    filter: drop-shadow(0 0 8px var(--color-accent-glow));
    animation: pulse-subtle 2s infinite ease-in-out;
  }

  .stats-bar {
    display: flex;
    gap: 16px;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .manage-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .manage-btn svg {
    width: 16px;
    height: 16px;
  }

  .backup-btn {
    border-color: rgba(16, 185, 129, 0.25);
    color: var(--color-success);
  }

  .backup-btn:hover:not(:disabled) {
    border-color: rgba(16, 185, 129, 0.55);
    background: rgba(16, 185, 129, 0.08);
  }

  .stat-badge {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  button.stat-badge {
    cursor: pointer;
    font-family: var(--font-body);
    color: var(--text-primary);
  }

  .stat-badge.success.active {
    border-color: var(--color-success);
    background: rgba(16, 185, 129, 0.12);
    box-shadow: 0 0 12px var(--color-success-glow);
  }

  .stat-badge.info.active {
    border-color: var(--color-accent);
    background: rgba(255, 255, 255, 0.12);
    box-shadow: 0 0 12px var(--color-accent-glow);
  }

  .stat-label {
    font-size: 0.8rem;
    text-transform: uppercase;
    color: var(--text-secondary);
    letter-spacing: 0.05em;
  }

  .stat-value {
    font-size: 1.1rem;
    font-weight: 700;
    font-family: var(--font-header);
    color: var(--text-primary);
  }

  .stat-badge.success {
    border-color: rgba(16, 185, 129, 0.2);
    background: rgba(16, 185, 129, 0.05);
  }
  .stat-badge.success .stat-value { color: var(--color-success); }

  .stat-badge.info {
    border-color: rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.05);
  }
  .stat-badge.info .stat-value { color: var(--color-accent); }

  @media (max-width: 1024px) {
    .app-header {
      padding: 16px 20px;
    }
  }

  @media (max-width: 768px) {
    .app-header {
      flex-direction: column;
      align-items: stretch;
      gap: 15px;
    }

    .brand {
      justify-content: center;
    }

    .stats-bar {
      justify-content: center;
      flex-wrap: wrap;
    }

    .manage-btn {
      flex: 1;
      min-width: 140px;
      justify-content: center;
    }
  }

  @media (max-width: 480px) {
    .brand {
      gap: 10px;
    }

    .brand-icon {
      width: 26px;
      height: 26px;
    }

    .brand h1 {
      font-size: 1.15rem;
      letter-spacing: 0.08em;
    }

    .stats-bar {
      gap: 10px;
    }

    .stat-badge {
      flex: 1;
      min-width: 90px;
      justify-content: center;
    }
  }
</style>
