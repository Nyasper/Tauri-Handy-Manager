export type ContextMenuItem =
  | {
      label: string;
      icon?: string;
      shortcut?: string;
      disabled?: boolean;
      action: () => void | Promise<void>;
      isSeparator?: never;
    }
  | {
      isSeparator: true;
      label?: never;
      icon?: never;
      shortcut?: never;
      disabled?: never;
      action?: never;
    };

export type ContextMenuType = "handy" | "owner" | "area" | "empty";

/**
 * Servicio global del menú contextual.
 *
 * Expone el estado reactivo (`isOpen`, `position`, `type`, `items`) que
 * `ContextMenu.svelte` consume para renderizar el menú en pantalla.
 */
export class ContextMenuService {
  /** Indica si el menú contextual está abierto. */
  isOpen = $state(false);

  /** Posición (viewport) donde se mostró el menú. */
  position = $state({ x: 0, y: 0 });

  /** Tipo de elemento sobre el que se abrió el menú, o `null` tras cerrarlo. */
  type: ContextMenuType | null = $state(null);

  /** Ítems a renderizar en el menú. */
  items: ContextMenuItem[] = $state([]);

  /**
   * Abre el menú contextual en la posición del evento y registra los listeners
   * globales que lo cierran al hacer clic o clic derecho fuera del menú.
   */
  show(e: MouseEvent, type: ContextMenuType, items: ContextMenuItem[]) {
    e.preventDefault();
    e.stopPropagation();

    // If already open, clean up previous listeners to avoid accumulation
    if (this.isOpen) {
      window.removeEventListener("click", this.close);
      window.removeEventListener("contextmenu", this.closeOutside);
    }

    this.position = { x: e.clientX, y: e.clientY };
    this.type = type;
    this.items = items;
    this.isOpen = true;

    window.addEventListener("click", this.close);
    window.addEventListener("contextmenu", this.closeOutside);
  }

  /** Cierra el menú contextual y libera los listeners globales. */
  close = () => {
    this.isOpen = false;
    this.type = null;
    window.removeEventListener("click", this.close);
    window.removeEventListener("contextmenu", this.closeOutside);
  };

  private closeOutside = (e: MouseEvent) => {
    e.preventDefault();
    this.close();
  };
}

export const contextMenu = new ContextMenuService();
