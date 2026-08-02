import { browser } from '$app/environment';
import { contextMenu } from './context-menu.service.svelte';
import { handyDB } from './db.service.svelte';

export interface ModalLayer {
  dismiss: () => void;
  confirm?: () => void;
  scope?: HTMLElement | null;
}

export interface AppActions {
  openAdmin: () => void;
  openHistory: () => void;
  quickSelect: (handyId: number) => void;
  resetView: () => void;
}

type Direction = 'left' | 'right' | 'up' | 'down';

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  '[role="button"]:not([tabindex="-1"])',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

function isEditable(el: Element | null): boolean {
  if (!el) return false;
  return el.matches(EDITABLE_SELECTOR) || el.closest(EDITABLE_SELECTOR) !== null;
}

function isNativeInteractive(el: Element | null): boolean {
  if (!el) return false;
  return (
    el.matches('button, input, select, textarea, a[href]') ||
    el.closest('button, input, select, textarea, a[href]') !== null
  );
}

function isVisible(el: HTMLElement): boolean {
  if ((el as HTMLButtonElement).disabled) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/** Pick the element closest in the given direction, wrapping around if none is ahead. */
function pickNext(
  direction: Direction,
  elements: HTMLElement[],
  current: HTMLElement,
): HTMLElement | null {
  const cr = current.getBoundingClientRect();
  const candidates = elements.filter((el) => el !== current && isVisible(el));
  if (candidates.length === 0) return null;

  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  let wrap: HTMLElement | null = null;
  let wrapScore = -Infinity;

  for (const el of candidates) {
    const r = el.getBoundingClientRect();
    const dx = r.left - cr.left;
    const dy = r.top - cr.top;

    const ahead =
      direction === 'right'
        ? r.left >= cr.right - 1
        : direction === 'left'
          ? r.right <= cr.left + 1
          : direction === 'down'
            ? r.top >= cr.bottom - 1
            : r.bottom <= cr.top + 1;

    const distX = Math.max(Math.abs(dx) - (r.width + cr.width) / 2, 0);
    const distY = Math.max(Math.abs(dy) - (r.height + cr.height) / 2, 0);

    if (ahead) {
      const score =
        direction === 'left' || direction === 'right'
          ? distX * 3 + distY
          : distY * 3 + distX;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    } else {
      const score =
        direction === 'left'
          ? dx
          : direction === 'right'
            ? -dx
            : direction === 'up'
              ? dy
              : -dy;
      if (score > wrapScore) {
        wrapScore = score;
        wrap = el;
      }
    }
  }

  return best ?? wrap;
}

function focusElement(el: HTMLElement | null) {
  if (!el) return;
  el.focus({ preventScroll: true });
  const rect = el.getBoundingClientRect();
  const margin = 12;
  if (
    rect.top < margin ||
    rect.bottom > window.innerHeight - margin ||
    rect.left < margin ||
    rect.right > window.innerWidth - margin
  ) {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

class ShortcutsService {
  private layers: ModalLayer[] = [];
  private focusables = new Set<HTMLElement>();
  private actions: AppActions | null = null;

  constructor() {
    if (!browser) return;
    window.addEventListener('keydown', this.handleKeyDown);
  }

  /** Register the app-level action handlers. Returns an unregister function. */
  setAppActions(actions: AppActions): () => void {
    this.actions = actions;
    return () => {
      if (this.actions === actions) this.actions = null;
    };
  }

  /** Push a modal layer onto the stack. Returns an unregister function. */
  pushModal(layer: ModalLayer): () => void {
    this.layers.push(layer);
    return () => {
      const idx = this.layers.indexOf(layer);
      if (idx !== -1) this.layers.splice(idx, 1);
    };
  }

  /** Svelte action that registers an element for arrow-key navigation. */
  rovingFocus = (el: HTMLElement) => {
    this.focusables.add(el);
    return {
      destroy: () => {
        this.focusables.delete(el);
      },
    };
  };

  private get topLayer(): ModalLayer | null {
    return this.layers.length > 0 ? this.layers[this.layers.length - 1] : null;
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const active = document.activeElement;
    const editable = isEditable(active);

    // Dismiss / cancel / go back
    if (e.key === 'Escape' || e.key === 'Delete') {
      if (e.key === 'Delete' && editable) return;
      if (this.dismissTop()) {
        e.preventDefault();
        return;
      }
      if (!contextMenu.isOpen) this.resetView();
      e.preventDefault();
      return;
    }

    // Accept / confirm
    if (e.key === 'Enter') {
      if (editable) return;
      const top = this.topLayer;
      if (top?.confirm && !isNativeInteractive(active)) {
        e.preventDefault();
        top.confirm();
      }
      return;
    }

    // Arrow-key navigation
    if (e.key.startsWith('Arrow')) {
      if (editable) return;
      if (contextMenu.isOpen) return; // the menu handles its own arrows
      const direction = e.key.slice(5).toLowerCase() as Direction;
      const elements = this.getNavElements();
      if (elements.length === 0) return;
      const current = this.currentNavElement(elements);
      if (!current) return;
      const next = pickNext(direction, elements, current);
      if (next) {
        e.preventDefault();
        focusElement(next);
      }
      return;
    }

    // Global app shortcuts only apply when no modal / menu is open
    if (this.topLayer || contextMenu.isOpen) return;

    if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      const key = e.key.toLowerCase();
      if (key === 'o' && this.actions) {
        e.preventDefault();
        this.actions.openAdmin();
        return;
      }
      if (key === 'h' && this.actions) {
        e.preventDefault();
        this.actions.openHistory();
        return;
      }
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        this.quickSelectFromKey(e.key, true);
        return;
      }
    }

    // Quick-select a handy with the number keys
    if (!e.ctrlKey && !e.metaKey && !e.altKey && !editable) {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        this.quickSelectFromKey(e.key, false);
      }
    }
  };

  private dismissTop(): boolean {
    const top = this.topLayer;
    if (!top) return false;
    top.dismiss();
    return true;
  }

  private resetView() {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    this.actions?.resetView();
  }

  private quickSelectFromKey(key: string, withCtrl: boolean) {
    if (!this.actions) return;
    const base = key === '0' ? 10 : Number(key);
    const handyId = withCtrl ? base + 10 : base;
    if (!handyDB.handies.some((h) => h.id === handyId)) return;
    this.actions.quickSelect(handyId);
  }

  private getNavElements(): HTMLElement[] {
    const top = this.topLayer;
    if (top?.scope) {
      return Array.from(
        top.scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(isVisible);
    }
    return Array.from(this.focusables).filter(isVisible);
  }

  private currentNavElement(elements: HTMLElement[]): HTMLElement | null {
    const active = document.activeElement;
    if (active instanceof HTMLElement && elements.includes(active)) return active;
    return elements[0] ?? null;
  }
}

export const shortcuts = new ShortcutsService();
