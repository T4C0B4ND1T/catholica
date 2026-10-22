import { formatDay } from '@/lib/dates';

/** All notes as one Markdown file, oldest first, each under its date. */
export function notesMarkdown(notes: { date: string; body: string }[]): string {
  const sorted = notes.filter((n) => n.body.trim() !== '').sort((a, b) => a.date.localeCompare(b.date));
  return ['# Catholica notes', '', ...sorted.flatMap((n) => [`## ${formatDay(n.date)}`, '', n.body.trim(), ''])].join('\n');
}
