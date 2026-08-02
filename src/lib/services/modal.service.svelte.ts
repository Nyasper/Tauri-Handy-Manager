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
  | { kind: 'confirm' | 'alert'; title: string; message: string; confirmLabel: string; cancelLabel?: string; danger?: boolean }
  | { kind: 'prompt'; title: string; message: string; defaultValue: string; confirmLabel: string; cancelLabel?: string };

export class ModalService {
  state = $state<ModalState | null>(null);

  private resolver: ((value: unknown) => void) | null = null;

  private open(state: ModalState): Promise<unknown> {
    this.state = state;
    return new Promise((res) => {
      this.resolver = res;
    });
  }

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

  alert(options: BaseModalOptions): Promise<void> {
    return this.open({
      kind: 'alert',
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel ?? 'Aceptar',
    }).then(() => undefined);
  }

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

  /** Resolve the active modal. Pass `null`/`false` to cancel. */
  resolve(value: unknown) {
    const resolver = this.resolver;
    this.state = null;
    this.resolver = null;
    resolver?.(value);
  }
}

export const modalService = new ModalService();
