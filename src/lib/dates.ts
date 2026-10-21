const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function parse(date: string): number {
  const m = ISO.exec(date);
  if (!m) throw new Error(`Invalid ISO date: ${date}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
}

function format(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function todayInChicago(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(date: string, n: number): string {
  return format(parse(date) + n * 86_400_000);
}

/** 0 = Sunday. */
export function dayOfWeek(date: string): number {
  return new Date(parse(date)).getUTCDay();
}

/** '2026-10-25' -> '102526' (MMDDYY). */
export function usccbSlug(date: string): string {
  const [y, m, d] = date.split('-');
  return `${m}${d}${y.slice(2)}`;
}

/** '2026-10-25' -> 'Sun, Oct 25, 2026'. */
export function formatDay(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(parse(date)));
}
