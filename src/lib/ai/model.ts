/** Single source for the AI model, a Vercel AI Gateway `provider/model` ID (safe to import anywhere). */
export function aiModel(): string {
  return process.env.AI_MODEL || 'openai/gpt-4.1-mini';
}

/**
 * Models AI Gateway tries, in order, when the main one fails. Comma separated in `AI_FALLBACK_MODELS`. The default is
 * from another provider, so one provider's outage doesn't stop the readings job.
 */
export function aiFallbackModels(): string[] {
  const raw = process.env.AI_FALLBACK_MODELS ?? 'google/gemini-2.5-flash-lite';
  return raw
    .split(',')
    .map((m) => m.trim())
    .filter((m) => m && m !== aiModel());
}
