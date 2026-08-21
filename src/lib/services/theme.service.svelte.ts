import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'hm-theme';

/**
 * Servicio global de tema (claro/oscuro) para Svelte 5.
 *
 * Lee la preferencia guardada en `localStorage` y la aplica como atributo
 * `data-theme` sobre `<html>`. Por defecto el tema es `dark`.
 */
class ThemeService {
  /** Tema activo de forma reactiva. */
  theme = $state<Theme>('dark');

  constructor() {
    if (!browser) return;
    this.theme = this.readStored();
    this.apply(this.theme);
  }

  /** Cambia al otro tema, lo persiste y lo aplica. */
  toggle() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    this.apply(this.theme);
  }

  private readStored(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' ? 'light' : 'dark';
  }

  private apply(theme: Theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }
}

export const theme = new ThemeService();
