export interface BaseModalOptions {
  title: string;
  message: string;
  confirmLabel?: string;
}

export interface ConfirmModalOptions extends BaseModalOptions {
  cancelLabel?: string;
  danger?: boolean;
}

export interface PromptModalOptions extends BaseModalOptions {
  defaultValue?: string;
  cancelLabel?: string;
}

export type ModalState =
  | { kind: 'confirm'; title: string; message: string; confirmLabel: string; cancelLabel: string; danger: boolean }
  | { kind: 'alert'; title: string; message: string; confirmLabel: string }
  | { kind: 'prompt'; title: string; message: string; defaultValue: string; confirmLabel: string; cancelLabel: string };

/**
 * Servicio global de modales (confirm, alert y prompt) para Svelte 5.
 *
 * Expone un estado reactivo (`state`) que `ModalHost.svelte` consume para renderizar
 * el modal, y devuelve promesas que se resuelven cuando el usuario interactúa con él.
 *
 * Uso típico:
 * ```ts
 * const ok = await modalService.confirm({ title: 'Borrar', message: '¿Seguro?' });
 * if (ok) { ... }
 * ```
 */
export class ModalService {
  /** Estado reactivo del modal activo. `null` cuando no hay ningún modal abierto. */
  state = $state<ModalState | null>(null);

  /** Resolvedor de la promesa devuelta por `open()` para el modal activo. */
  private resolver: ((value: unknown) => void) | null = null;

  /**
   * Abre un modal con el estado dado y devuelve una promesa que se resuelve
   * cuando `resolve()` sea llamado. Si ya hay otro modal abierto, el anterior
   * se cancela automáticamente para evitar que su promesa quede colgada.
   */
  private open(state: ModalState): Promise<unknown> {
    if (this.resolver) {
      this.resolver(this.state?.kind === 'prompt' ? null : false);
    }
    this.state = state;
    return new Promise((res) => {
      this.resolver = res;
    });
  }

  /**
   * Muestra un modal de confirmación con dos botones (Confirmar / Cancelar).
   * @param options `title`, `message` y opcionalmente `confirmLabel`, `cancelLabel` y `danger`.
   * @returns `true` si el usuario confirma; `false` si cancela o cierra.
   */
  confirm(options: ConfirmModalOptions): Promise<boolean> {
    return this.open({
      kind: 'confirm',
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel ?? 'Confirmar',
      cancelLabel: options.cancelLabel ?? 'Cancelar',
      danger: options.danger ?? false,
    }).then((value) => value === true);
  }

  /**
   * Muestra un modal informativo con un único botón (Aceptar).
   * @param options `title`, `message` y opcionalmente `confirmLabel`.
   * @returns Promesa que se resuelve (sin valor) cuando el usuario acepta o cierra.
   */
  alert(options: BaseModalOptions): Promise<void> {
    return this.open({
      kind: 'alert',
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel ?? 'Aceptar',
    }).then(() => undefined);
  }

  /**
   * Muestra un modal con un campo de texto editable.
   * @param options `title`, `message` y opcionalmente `defaultValue`, `confirmLabel` y `cancelLabel`.
   * @returns El texto ingresado como `string`, o `null` si el usuario cancela o cierra.
   */
  prompt(options: PromptModalOptions): Promise<string | null> {
    return this.open({
      kind: 'prompt',
      title: options.title,
      message: options.message,
      defaultValue: options.defaultValue ?? '',
      confirmLabel: options.confirmLabel ?? 'Aceptar',
      cancelLabel: options.cancelLabel ?? 'Cancelar',
    }).then((value) => {
      if (value === null) return null;
      return String(value);
    });
  }

  /**
   * Resuelve el modal activo y lo cierra.
   * Pasa `true` para confirmar, el texto ingresado en un prompt,
   * o `false`/`null` para cancelar.
   */
  resolve(value: unknown) {
    const resolver = this.resolver;
    this.state = null;
    this.resolver = null;
    resolver?.(value);
  }
}

/** Instancia única compartida del servicio de modales. */
export const modalService = new ModalService();
