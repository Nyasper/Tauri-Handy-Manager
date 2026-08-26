export type ToastKind = 'success' | 'danger';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const TOAST_DURATION_MS = 3500;

/**
 * Servicio global de toasts (notificaciones efímeras) para Svelte 5.
 *
 * Expone un estado reactivo (`toasts`) que `ToastHost.svelte` consume para
 * renderizar las notificaciones, y cada toast se auto-descarta tras unos
 * segundos. Se usa para confirmar acciones que modifican la base de datos.
 */
class ToastService {
  /** Lista de toasts activos (el más reciente al final). */
  toasts = $state<ToastItem[]>([]);

  private nextId = 1;

  /** Muestra un toast de éxito. */
  success(message: string) {
    this.push('success', message);
  }

  /** Muestra un toast de error. */
  error(message: string) {
    this.push('danger', message);
  }

  private push(kind: ToastKind, message: string) {
    const id = this.nextId++;
    this.toasts = [...this.toasts, { id, kind, message }];
    setTimeout(() => this.dismiss(id), TOAST_DURATION_MS);
  }

  /** Descarta (oculta) un toast por su id. */
  dismiss(id: number) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }
}

/** Instancia única compartida del servicio de toasts. */
export const toastService = new ToastService();
