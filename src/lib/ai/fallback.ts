/** How long a model that was overloaded, too slow or missing is skipped before it is tried again. */
const COOL_OFF_MS = 10 * 60_000;
/** Each call tries at most this many models, so one call can't use up a cron run's time limit. */
const MAX_MODELS_PER_CALL = 2;

/** Errors that mean "try another model": overloaded (503), deadline (504), quota (429), unknown model (404). */
export function isRetryable(e: unknown): boolean {
  const status = (e as { status?: unknown })?.status;
  if (typeof status === 'number') return [404, 429, 500, 503, 504].includes(status);
  return /\b(UNAVAILABLE|DEADLINE_EXCEEDED|RESOURCE_EXHAUSTED|NOT_FOUND|aborted|timed? ?out)\b/i.test(String(e));
}

const downUntil = new Map<string, number>();

/** Test hook: forget which models are cooling off. */
export function resetModelHealth(): void {
  downUntil.clear();
}

/**
 * Runs `call` with the first healthy model, moving to the next one when a model is overloaded or too slow. A model
 * that fails that way is skipped for the next ten minutes, so the rest of a cron run goes straight to one that answers.
 */
export async function withFallback<T>(
  models: string[],
  call: (model: string) => Promise<T>,
  now: () => number = Date.now,
): Promise<T> {
  const healthy = models.filter((m) => (downUntil.get(m) ?? 0) <= now());
  const order = (healthy.length ? healthy : models.slice(0, 1)).slice(0, MAX_MODELS_PER_CALL);
  let last: unknown;
  for (const model of order) {
    try {
      return await call(model);
    } catch (e) {
      if (!isRetryable(e)) throw e;
      downUntil.set(model, now() + COOL_OFF_MS);
      last = e;
    }
  }
  throw last;
}
