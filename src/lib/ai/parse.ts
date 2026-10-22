/** Parsers for Gemini's JSON answers (safe to import anywhere). */

/** The questions from Gemini's JSON answer: 1 to 6 non-empty strings, or it throws. */
export function parseQuestions(text: string): string[] {
  let value: unknown;
  try {
    value = JSON.parse(text.trim());
  } catch {
    throw new Error('Gemini returned questions that are not JSON');
  }
  const list = Array.isArray(value) ? value.filter((q): q is string => typeof q === 'string' && q.trim() !== '') : [];
  if (list.length === 0) throw new Error('Gemini returned no questions');
  return list.slice(0, 6).map((q) => q.trim());
}
