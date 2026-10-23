import { describe, expect, it } from 'vitest';
import { parseBulletinSummary, parseInsights, parseQuestions } from '@/lib/ai/parse';

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

describe('parseInsights', () => {
  it('reads JSON wrapped in a code fence', () => {
    const i = parseInsights('```json\n' + JSON.stringify({ theology: 'T', catechism: [], prayer: 'P' }) + '\n```');
    expect(i.theology).toBe('T');
    expect(i.prayer).toBe('P');
  });


  it('keeps valid Catechism items, at most four, without repeats', () => {
    const i = parseInsights(
      JSON.stringify({
        theology: ' Covenant thread ',
        prayer: ' Pray with the image of fire. ',
        catechism: [
          { paragraph: 1324, connection: ' Source and summit. ' },
          { paragraph: '2559', connection: 'Prayer as gift.' },
          { paragraph: 1324, connection: 'repeat' },
          { paragraph: 9999, connection: 'out of range' },
          { paragraph: 12.5, connection: 'not whole' },
          { paragraph: 27, connection: '' },
          { paragraph: 1, connection: 'a' },
          { paragraph: 2, connection: 'b' },
          { paragraph: 3, connection: 'c' },
        ],
      }),
    );
    expect(i.theology).toBe('Covenant thread');
    expect(i.prayer).toBe('Pray with the image of fire.');
    expect(i.catechism).toEqual([
      { paragraph: 1324, connection: 'Source and summit.' },
      { paragraph: 2559, connection: 'Prayer as gift.' },
      { paragraph: 1, connection: 'a' },
      { paragraph: 2, connection: 'b' },
    ]);
  });

  it('throws on non-JSON or a missing theology note or prayer', () => {
    expect(() => parseInsights('Theology: x')).toThrow(/not JSON/);
    expect(() => parseInsights('{"theology": "x"}')).toThrow(/prayer/);
    expect(() => parseInsights('{"prayer": "x", "theology": " "}')).toThrow(/theology/);
  });

  it('allows no Catechism items', () => {
    expect(parseInsights('{"theology": "t", "prayer": "p"}').catechism).toEqual([]);
  });
});
