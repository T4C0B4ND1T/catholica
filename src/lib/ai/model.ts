/** Single source for the Gemini model name (safe to import anywhere). */
export function geminiModel(): string {
  return process.env.GEMINI_MODEL || 'gemini-3.8-flash';
}

/**
 * Models to try, in order, when the main one is overloaded or too slow. Comma separated in `GEMINI_FALLBACK_MODELS`. Both defaults are
 * stable in the Gemini API and take a thinking level; gemini-2.5-flash is closed to new keys.
 */
export function geminiFallbackModels(): string[] {
  const raw = process.env.GEMINI_FALLBACK_MODELS ?? 'gemini-3.6-flash,gemini-3.5-flash-lite';
  return raw
    .split(',')
    .map((m) => m.trim())
    .filter((m) => m && m !== geminiModel());
}
