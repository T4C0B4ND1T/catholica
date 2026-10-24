import { describe, expect, it } from 'vitest';
import { parseBulletinSummary, parseInsights, parseQuestions, parseStudy } from '@/lib/ai/parse';

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

describe('parseStudy', () => {
  const item = (index: number, extra: object = {}) => ({
    index,
    context: { who: ' Isaiah ', when: '8th c. BC', where: 'Jerusalem', why: 'Hope in exile' },
    explanation: 'It means this.',
    reflection: 'Pray this.',
    ...extra,
  });

  it('keeps the asked-for readings once each, in index order, trimmed', () => {
    const out = parseStudy('```json\n' + JSON.stringify([item(3), item(0), item(0), item(9)]) + '\n```', [0, 3]);
    expect(out.map((r) => r.index)).toEqual([0, 3]);
    expect(out[0].context.who).toBe('Isaiah');
  });

  it('accepts an object with a readings array and fills missing context with empty strings', () => {
    const out = parseStudy(JSON.stringify({ readings: [{ index: 2, explanation: 'E' }] }), [2]);
    expect(out).toEqual([{ index: 2, context: { who: '', when: '', where: '', why: '' }, explanation: 'E', reflection: '' }]);
  });

  it('drops readings without an explanation and throws when none are left or it is not JSON', () => {
    expect(() => parseStudy(JSON.stringify([item(0, { explanation: ' ' })]), [0])).toThrow('no study notes');
    expect(() => parseStudy('Here are your notes', [0])).toThrow('not JSON');
  });
});
