/** Single source for the Gemini model name (safe to import anywhere). */
export function geminiModel(): string {
  return process.env.GEMINI_MODEL || 'gemini-3.8-flash';
}
