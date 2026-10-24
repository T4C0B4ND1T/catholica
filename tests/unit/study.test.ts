import { describe, expect, it } from 'vitest';
import { studyDepthOf, studyGroups, studyLevel } from '@/lib/study';
import type { ReadingSection } from '@/lib/types';

describe('studyLevel', () => {
  it('goes in depth on Sundays and holy days by default', () => {
    expect(studyLevel('2026-10-25', 'sundays')).toBe('full'); // Sunday
    expect(studyLevel('2026-12-08', 'sundays')).toBe('full'); // Immaculate Conception, a Tuesday
    expect(studyLevel('2026-10-21', 'sundays')).toBe('brief');
  });

  it('follows brief and deep every day', () => {
    expect(studyLevel('2026-10-25', 'brief')).toBe('brief');
    expect(studyLevel('2026-10-21', 'deep')).toBe('full');
  });
});

describe('studyDepthOf', () => {
  it('reads a valid setting and falls back to Sundays', () => {
    expect(studyDepthOf({ study_depth: 'deep' })).toBe('deep');
    expect(studyDepthOf({ study_depth: 'loud' })).toBe('sundays');
    expect(studyDepthOf(null)).toBe('sundays');
  });
});

describe('studyGroups', () => {
  const s = (kind: ReadingSection['kind'], mass?: string): ReadingSection => ({ kind, mass, title: kind, citation: 'c', text: 't' });

  it('skips the Gospel Acclamation and Sequence and keeps section indexes', () => {
    const groups = studyGroups([s('reading1'), s('psalm'), s('reading2'), s('sequence'), s('alleluia'), s('gospel')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((i) => i.index)).toEqual([0, 1, 2, 5]);
  });

  it('groups by Mass in page order', () => {
    const groups = studyGroups([s('reading1', 'Vigil'), s('gospel', 'Vigil'), s('reading1', 'Day'), s('gospel', 'Day')]);
    expect(groups.map((g) => [g.mass, g.items.map((i) => i.index)])).toEqual([
      ['Vigil', [0, 1]],
      ['Day', [2, 3]],
    ]);
  });
});
