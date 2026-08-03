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

export type NavZone = 'header' | 'search' | 'grid';

const ZONE_IDS: NavZone[] = ['header', 'search', 'grid'];

type Direction = 'left' | 'right' | 'up' | 'down';

interface Zone {
  id: NavZone;
  elements: Set<HTMLElement>;
}

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

/** Group elements into rows by vertical overlap, each row sorted left-to-right. */
function getRows(elements: HTMLElement[]): HTMLElement[][] {
  const sorted = [...elements].sort(
    (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
  );
  const rows: HTMLElement[][] = [];
  for (const el of sorted) {
    const r = el.getBoundingClientRect();
    const row = rows.find((rr) => {
      const tr = rr[0].getBoundingClientRect();
      return r.top < tr.bottom && r.bottom > tr.top;
    });
    if (row) row.push(el);
    else rows.push([el]);
  }
  for (const row of rows) {
    row.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  }
  return rows;
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
  private zones: Zone[] = ZONE_IDS.map((id) => ({ id, elements: new Set<HTMLElement>() }));
  private layers: ModalLayer[] = [];
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

  /**
   * Svelte action that registers an element for arrow-key navigation.
   * Provide a zone to join the main-page navigation zones, or leave it
   * undefined for elements that should not participate (e.g. modal inputs).
   */
  rovingFocus = (el: HTMLElement, zone?: NavZone) => {
    if (zone) {
      const target = this.zones.find((z) => z.id === zone);
      target?.elements.add(el);
    }
    return {
      destroy: () => {
        if (zone) {
          const target = this.zones.find((z) => z.id === zone);
          target?.elements.delete(el);
        }
      },
    };
  };

  private get topLayer(): ModalLayer | null {
    return this.layers.length > 0 ? this.layers[this.layers.length - 1] : null;
  }

  private zoneOf(el: Element | null): NavZone | null {
    if (!el || !(el instanceof HTMLElement)) return null;
    for (const zone of this.zones) {
      if (zone.elements.has(el)) return zone.id;
    }
    return null;
  }

  private getMainElements(): HTMLElement[] {
    const els: HTMLElement[] = [];
    for (const zone of this.zones) {
      for (const el of zone.elements) {
        if (isVisible(el)) els.push(el);
      }
    }
    return els;
  }

  private getModalElements(): HTMLElement[] {
    const top = this.topLayer;
    if (!top?.scope) return [];
    return Array.from(
      top.scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter(isVisible);
  }

  private currentNavElement(elements: HTMLElement[]): HTMLElement | null {
    const active = document.activeElement;
    if (active instanceof HTMLElement && elements.includes(active)) return active;
    return elements[0] ?? null;
  }

  /** Row-major arrow navigation within a set of elements. */
  private navigateRows(direction: Direction, elements: HTMLElement[], e: KeyboardEvent) {
    if (elements.length === 0) return;
    const rows = getRows(elements);
    const active = document.activeElement;
    const current =
      active instanceof HTMLElement && elements.includes(active) ? active : null;

    let target: HTMLElement | null = null;

    if (current) {
      const cr = current.getBoundingClientRect();
      let rowIdx = rows.findIndex((row) => row.includes(current));
      if (rowIdx === -1) rowIdx = 0;
      const colIdx = rows[rowIdx].indexOf(current);

      if (direction === 'right' || direction === 'left') {
        const delta = direction === 'right' ? 1 : -1;
        const nextCol = colIdx + delta;
        if (nextCol >= 0 && nextCol < rows[rowIdx].length) {
          target = rows[rowIdx][nextCol];
        } else {
          let r = rowIdx + delta;
          if (r < 0) r = rows.length - 1;
          if (r >= rows.length) r = 0;
          if (r === rowIdx) {
            target = rows[rowIdx][(nextCol + rows[rowIdx].length) % rows[rowIdx].length];
          } else {
            target = delta === 1 ? rows[r][0] : rows[r][rows[r].length - 1];
          }
        }
      } else {
        const delta = direction === 'down' ? 1 : -1;
        let r = rowIdx + delta;
        if (r < 0) r = rows.length - 1;
        if (r >= rows.length) r = 0;
        if (r === rowIdx) {
          target = rows[rowIdx][0];
        } else {
          target = this.nearestInRow(rows[r], cr);
        }
      }
    } else {
      target = rows[0]?.[0] ?? null;
    }

    if (target && target !== current) {
      e.preventDefault();
      focusElement(target);
    }
  }

  /** Row-major arrow navigation across the main-page zones. */
  private navigateMainPage(direction: Direction, e: KeyboardEvent) {
    this.navigateRows(direction, this.getMainElements(), e);
  }

  /**
   * Group the top modal's focusable elements into sections marked with
   * `data-nav-section`. Sections follow DOM order; unmarked elements go into
   * a trailing "general" section (e.g. the modal close button).
   */
  private getModalSections(): HTMLElement[][] {
    const top = this.topLayer;
    if (!top?.scope) return [];
    const focusables = Array.from(
      top.scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter(isVisible);
    if (focusables.length === 0) return [];

    const marked = new Map<HTMLElement, HTMLElement[]>();
    const order: HTMLElement[] = [];
    const general: HTMLElement[] = [];

    for (const el of focusables) {
      const section = el.closest<HTMLElement>('[data-nav-section]');
      if (section) {
        if (!marked.has(section)) order.push(section);
        const arr = marked.get(section) ?? [];
        arr.push(el);
        marked.set(section, arr);
      } else {
        general.push(el);
      }
    }

    const sections = order
      .map((container) => marked.get(container)!)
      .filter((els) => els.length > 0);
    if (general.length > 0) sections.push(general);
    return sections;
  }

  /** Cycle the focus to the next/previous modal section. */
  private focusNextSection(sections: HTMLElement[][], dir: 1 | -1) {
    const active = document.activeElement;
    const currentIdx = sections.findIndex(
      (els) => active instanceof HTMLElement && els.includes(active),
    );
    const start =
      currentIdx === -1 ? (dir === 1 ? -1 : sections.length) : currentIdx;
    const n = sections.length;
    for (let i = 1; i <= n; i++) {
      const idx = (start + dir * i + n * 2) % n;
      if (sections[idx].length > 0) {
        focusElement(sections[idx][0]);
        return;
      }
    }
  }

  private nearestInRow(row: HTMLElement[], cr: DOMRect): HTMLElement {
    let best = row[0];
    let bestDist = Infinity;
    const cCenter = (cr.left + cr.right) / 2;
    for (const el of row) {
      const r = el.getBoundingClientRect();
      const center = (r.left + r.right) / 2;
      const d = Math.abs(center - cCenter);
      if (d < bestDist) {
        bestDist = d;
        best = el;
      }
    }
    return best;
  }

  /** Cycle the focus to the next/previous zone (header → search → grid → header). */
  private focusNextZone(dir: 1 | -1) {
    const active = document.activeElement;
    const activeZone = this.zoneOf(active);
    let startIdx: number;
    if (activeZone) {
      startIdx = ZONE_IDS.indexOf(activeZone);
    } else {
      startIdx = dir === 1 ? -1 : ZONE_IDS.length;
    }

    const n = ZONE_IDS.length;
    for (let i = 1; i <= n; i++) {
      const idx = (startIdx + dir * i + n * 2) % n;
      const visible = Array.from(this.zones[idx].elements).filter(isVisible);
      if (visible.length > 0) {
        focusElement(visible[0]);
        return;
      }
    }
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

    // Tab / Shift+Tab rotate between zones on the main page, and between
    // sections inside a modal with data-nav-section markers (native otherwise)
    if (e.key === 'Tab') {
      if (contextMenu.isOpen) return;
      if (this.topLayer) {
        const sections = this.getModalSections();
        if (sections.length > 1) {
          e.preventDefault();
          this.focusNextSection(sections, e.shiftKey ? -1 : 1);
        }
        return;
      }
      e.preventDefault();
      this.focusNextZone(e.shiftKey ? -1 : 1);
      return;
    }

    // Arrow-key navigation
    if (e.key.startsWith('Arrow')) {
      if (editable) return;
      if (contextMenu.isOpen) return; // the menu handles its own arrows
      const direction = e.key.slice(5).toLowerCase() as Direction;

      if (this.topLayer) {
        if (this.getModalSections().length > 1) {
          // Modal with sections: row-major navigation across all focusables
          this.navigateRows(direction, this.getModalElements(), e);
        } else {
          // Modal without sections: spatial navigation within the modal scope
          const elements = this.getModalElements();
          if (elements.length === 0) return;
          const current = this.currentNavElement(elements);
          if (!current) return;
          const next = pickNext(direction, elements, current);
          if (next) {
            e.preventDefault();
            focusElement(next);
          }
        }
        return;
      }

      // Main page: row-major navigation across zones
      this.navigateMainPage(direction, e);
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
}

export const shortcuts = new ShortcutsService();
