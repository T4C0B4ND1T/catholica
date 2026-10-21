/** Strict YYYY-MM-DD calendar date, years 1970–2100. */
export function validBulletinDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const year = Number(s.slice(0, 4));
  if (year < 1970 || year > 2100) return false;
  return new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
}

export interface SnippetPart {
  text: string;
  mark: boolean;
}

/**
 * Splits a ts_headline string into text and highlighted parts. Only the exact `<mark>`/`</mark>` tags are
 * treated as markup; everything else stays literal text for React to escape.
 */
export function snippetParts(snippet: string): SnippetPart[] {
  const parts: SnippetPart[] = [];
  const re = /<mark>([\s\S]*?)<\/mark>/g;
  let last = 0;
  for (let m = re.exec(snippet); m; m = re.exec(snippet)) {
    if (m.index > last) parts.push({ text: snippet.slice(last, m.index), mark: false });
    parts.push({ text: m[1], mark: true });
    last = m.index + m[0].length;
  }
  if (last < snippet.length) parts.push({ text: snippet.slice(last), mark: false });
  return parts;
}
