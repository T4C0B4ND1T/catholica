/** Which readings the study guide covers and how deep it goes on a day (safe to import anywhere). */

import { dayOfWeek } from '@/lib/dates';
import { holyDayOfObligation } from '@/lib/liturgical/holy-days';
import type { ReadingKind, ReadingSection, StudyDepth, StudyLevel } from '@/lib/types';

/** The default depth: the full study on Sundays and holy days, brief notes on other days. */
export const DEFAULT_STUDY_DEPTH: StudyDepth = 'sundays';

/** auth user_metadata key holding the reader's StudyDepth. */
export const STUDY_DEPTH_KEY = 'study_depth';

/** The readings with study notes. The Gospel Acclamation and Sequence have none; 'other' covers Vigil readings. */
const STUDIED: ReadonlySet<ReadingKind> = new Set(['reading1', 'psalm', 'reading2', 'gospel', 'other']);

export function isStudyDepth(v: unknown): v is StudyDepth {
  return v === 'brief' || v === 'sundays' || v === 'deep';
}

/** The depth stored in user metadata, or the default. */
export function studyDepthOf(metadata: Record<string, unknown> | null | undefined): StudyDepth {
  const v = metadata?.[STUDY_DEPTH_KEY];
  return isStudyDepth(v) ? v : DEFAULT_STUDY_DEPTH;
}

/** The study level for a date at a depth. */
export function studyLevel(date: string, depth: StudyDepth): StudyLevel {
  if (depth === 'deep') return 'full';
  if (depth === 'brief') return 'brief';
  return dayOfWeek(date) === 0 || holyDayOfObligation(date) ? 'full' : 'brief';
}

/** The day's studied sections, grouped by Mass in page order, each with its index in `sections`. */
export function studyGroups(sections: ReadingSection[]): { mass: string | null; items: { index: number; section: ReadingSection }[] }[] {
  const groups: { mass: string | null; items: { index: number; section: ReadingSection }[] }[] = [];
  sections.forEach((section, index) => {
    if (!STUDIED.has(section.kind) || !section.text.trim()) return;
    const mass = section.mass ?? null;
    let g = groups.find((x) => x.mass === mass);
    if (!g) groups.push((g = { mass, items: [] }));
    g.items.push({ index, section });
  });
  return groups;
}
