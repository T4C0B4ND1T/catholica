import { SECTION_LABELS } from '@/lib/section-labels';
import type { ReadingKind, ReadingSection } from '@/lib/types';

/** The Mass shown first on a day of several Masses, when USCCB lists it. */
export const DAY_MASS = 'Mass during the Day';

/** One section of the chosen Mass, with its place in the day's full list and a label unique within that Mass. */
export interface MassSection {
  section: ReadingSection;
  /** Index in the day's `sections`, stable across Masses (card ids, bookmark keys). */
  index: number;
  /** Pill, card and aria label: the kind's name, or the section's own title when the kind repeats. */
  label: string;
}

/** The day's Mass names in page order; empty on a single-Mass day. */
export function massNames(sections: ReadingSection[]): string[] {
  const names: string[] = [];
  for (const s of sections) if (s.mass && !names.includes(s.mass)) names.push(s.mass);
  return names;
}

/** "Mass during the Day" when the day has it, else the last Mass; null on a single-Mass day. */
export function defaultMass(sections: ReadingSection[]): string | null {
  const names = massNames(sections);
  if (!names.length) return null;
  return names.includes(DAY_MASS) ? DAY_MASS : names[names.length - 1];
}

const ALTERNATE = /^or:?$/i;

/**
 * The sections of one Mass (every section when `mass` is null), labelled so no two pills read the same: a kind that
 * occurs once is named by kind ("First Reading"); a repeated kind, or an unclassified section, uses the section's own
 * title ("Reading III"), and a bare "Or" alternate reads "Or: Second Reading".
 */
export function massSections(sections: ReadingSection[], mass: string | null): MassSection[] {
  const picked = sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => mass === null || section.mass === mass);
  const counts = new Map<ReadingKind, number>();
  for (const { section } of picked) counts.set(section.kind, (counts.get(section.kind) ?? 0) + 1);

  const seen = new Map<string, number>();
  return picked.map(({ section, index }) => {
    const kindLabel = SECTION_LABELS[section.kind];
    let label = kindLabel;
    if (section.kind === 'other' || (counts.get(section.kind) ?? 0) > 1) {
      label = ALTERNATE.test(section.title) ? `Or: ${kindLabel}` : section.title || kindLabel;
    }
    // Two identical titles in one Mass still get distinct labels.
    const key = label.toLowerCase();
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return { section, index, label: n > 1 ? `${label} (${n})` : label };
  });
}

/** The section of `kind` shown on the Mass tab and the This Sunday card: the first one in the default Mass. */
export function sectionForKind(sections: ReadingSection[], kind: ReadingKind): MassSection | undefined {
  return massSections(sections, defaultMass(sections)).find((m) => m.section.kind === kind);
}

/** A label that also names the Mass on a multi-Mass day, for bookmarks and screen readers. */
export function fullLabel(m: MassSection): string {
  return m.section.mass ? `${m.label}, ${m.section.mass}` : m.label;
}

/**
 * The bookmarks.section value for a section: its index in the day plus its label, so the Me tab can name it without
 * loading the readings. Older bookmarks store just the kind ("gospel").
 */
export function bookmarkKey(m: MassSection): string {
  return `${m.index}|${fullLabel(m)}`;
}

/** What the Me tab shows for a stored bookmarks.section value, old (kind) or new (index|label). */
export function bookmarkLabel(section: string): string {
  if (Object.hasOwn(SECTION_LABELS, section)) return SECTION_LABELS[section as ReadingKind];
  const m = /^\d{1,3}\|(.+)$/.exec(section);
  return m ? m[1] : section;
}

/** True for a bookmarks.section value this app writes: a kind, or `index|label`. */
export function isBookmarkSection(v: string): boolean {
  if (Object.hasOwn(SECTION_LABELS, v)) return true;
  return /^\d{1,3}\|[^\u0000-\u001f\u007f]{1,300}$/.test(v) && v.trim() === v;
}
