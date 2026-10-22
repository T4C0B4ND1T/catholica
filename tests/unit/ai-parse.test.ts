import { describe, expect, it } from 'vitest';
import { parseBulletinSummary, parseQuestions } from '@/lib/ai/parse';

describe('parseQuestions', () => {
  it('keeps non-empty strings, trimmed, at most six', () => {
    expect(parseQuestions(' ["  One? ", "", 3, "Two?"] ')).toEqual(['One?', 'Two?']);
    expect(parseQuestions(JSON.stringify(Array.from({ length: 9 }, (_, i) => `Q${i}`)))).toHaveLength(6);
  });

  it('throws on non-JSON or an empty list', () => {
    expect(() => parseQuestions('1. One?')).toThrow(/not JSON/);
    expect(() => parseQuestions('[]')).toThrow(/no questions/);
    expect(() => parseQuestions('{"q": "x"}')).toThrow(/no questions/);
  });
});

describe('parseBulletinSummary', () => {
  it('keeps the known fields and drops empty entries', () => {
    const s = parseBulletinSummary(
      JSON.stringify({
        massTimes: ['Saturday 4:00 PM', ''],
        confession: ['Saturday 3:00 PM'],
        announcements: [{ title: 'Fall festival', text: 'Nov 7, parish hall.' }, { title: '', text: '' }, 'x'],
        extra: 'ignored',
      }),
    );
    expect(s).toEqual({
      massTimes: ['Saturday 4:00 PM'],
      confession: ['Saturday 3:00 PM'],
      announcements: [{ title: 'Fall festival', text: 'Nov 7, parish hall.' }],
    });
  });

  it('throws on non-JSON or an empty summary', () => {
    expect(() => parseBulletinSummary('Mass at 9')).toThrow(/not JSON/);
    expect(() => parseBulletinSummary('{"massTimes": []}')).toThrow(/empty/);
  });
});
