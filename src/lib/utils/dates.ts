const DATE_LOCALE = 'es-UY';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Today's date as YYYY-MM-DD (local time). */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Format a timestamp as date + time (dd/mm/yyyy hh:mm). Returns the raw value if invalid. */
export function formatDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString(DATE_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Format a timestamp as date only (dd/mm/yyyy). Returns '' if invalid. */
export function formatDateOnly(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(DATE_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Format a timestamp as time only (hh:mm). Returns '' if invalid. */
export function formatTimeOnly(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(DATE_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
