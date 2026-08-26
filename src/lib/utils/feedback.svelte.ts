const FEEDBACK_DURATION_MS = 3000;

export interface Feedback {
  error: string | null;
  success: string | null;
  clear: () => void;
  setError: (message: string) => void;
  setSuccess: (message: string) => void;
}

/**
 * Estado de feedback inline (error/success) para modales, con auto-descarte
 * tras unos segundos. Se usa en conjunto con <Alert> para mostrar mensajes
 * efímeros y clickeables dentro del modal.
 */
export function createFeedback(): Feedback {
  const state = $state({
    error: null as string | null,
    success: null as string | null,
  });
  let timer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (!state.error && !state.success) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      state.error = null;
      state.success = null;
      timer = null;
    }, FEEDBACK_DURATION_MS);
    return () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
  });

  return {
    get error() {
      return state.error;
    },
    get success() {
      return state.success;
    },
    clear: () => {
      state.error = null;
      state.success = null;
    },
    setError: (message: string) => {
      state.error = message;
      state.success = null;
    },
    setSuccess: (message: string) => {
      state.success = message;
      state.error = null;
    },
  };
}
