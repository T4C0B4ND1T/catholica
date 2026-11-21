import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { alignVerses, parseCitation, verseRuns, withVerseLabels } from '@/lib/verses';

vi.mock('server-only', () => ({}));
const { addVerses, bibleChapterUrl, parseBibleChapter } = await import('@/lib/sources/bible');
const { parseUsccb } = await import('@/lib/sources/usccb');

const bible = (name: string) => readFileSync(join(__dirname, '../fixtures/bible', `${name}.html`), 'utf8');
const usccb = (name: string) => readFileSync(join(__dirname, '../fixtures/usccb', `${name}.html`), 'utf8');
const refs = (c: string) => parseCitation(c)?.refs.map((r) => `${r.chapter}:${r.verse}`);

describe('parseCitation', () => {
  it('reads ranges, single verses and verse letters', () => {
    expect(parseCitation('Ephesians 3:2-12')?.book).toBe('ephesians');
    expect(refs('Isaiah 40:1-5, 9-11')).toEqual(['40:1', '40:2', '40:3', '40:4', '40:5', '40:9', '40:10', '40:11']);
    expect(refs('Psalm 85:9ab and 10, 11-12')).toEqual(['85:9', '85:10', '85:11', '85:12']);
    expect(refs('Revelation 11:19A; 12:1-3')).toEqual(['11:19', '12:1', '12:2', '12:3']);
  });

  it('reads numbered books, "See" and "Cf.", and the misspellings USCCB has published', () => {
    expect(parseCitation('1 Thessalonians 1:5c-10')?.book).toBe('1thessalonians');
    expect(parseCitation('See Luke 19:38; 2:14')?.book).toBe('luke');
    expect(refs('See Luke 19:38; 2:14')).toEqual(['19:38', '2:14']);
    expect(parseCitation('Cf. John 17:17b, 17a')?.refs).toEqual([{ chapter: 17, verse: 17 }]);
    expect(parseCitation('Phippians 3:8-9')?.book).toBe('philippians');
    expect(parseCitation('Psalm103:1-2')?.book).toBe('psalms');
  });

  it('reads a range across a chapter break', () => {
    const r = refs('Matthew 9:35–10:1, 5a, 6-8')!;
    expect(r[0]).toBe('9:35');
    expect(r.slice(-5)).toEqual(['10:1', '10:5', '10:6', '10:7', '10:8']);
  });

  it('adds the verses of a shorter form after "or"', () => {
    expect(refs('Mark 5:21-24 or 5:21-22, 35b-36')).toEqual(['5:21', '5:22', '5:23', '5:24', '5:35', '5:36']);
  });

  it('reads one-chapter books by verse alone', () => {
    expect(refs('Philemon 7-9')).toEqual(['1:7', '1:8', '1:9']);
  });

  it.each(['', 'Victimae paschali laudes', '137:1-2, 3', 'Esther C:12, 14-16', 'Psalm 85:9-10-11-12'])(
    'gives up on %j',
    (c) => expect(parseCitation(c)).toBeNull(),
  );
});

describe('parseBibleChapter', () => {
  it('splits a prose chapter at its verse numbers and leaves out notes', () => {
    const v = parseBibleChapter(bible('ephesians-3'));
    expect(v.get(2)).toBe('if, as I suppose, you have heard of the stewardship of God’s grace that was given to me for your benefit,');
    expect(v.get(21)).toMatch(/^to him be glory in the church/);
  });

  it('keeps every line of a psalm verse', () => {
    const v = parseBibleChapter(bible('psalms-18'));
    expect(v.get(2)).toBe("He said: I love you, LORD, my strength,");
  });
});

describe('alignVerses', () => {
  it('puts each verse where it begins, the first at the start even with an opening the Bible lacks', () => {
    const text = 'Brothers and sisters:\nYou have heard of the gift given to me.\nAnd now I tell you more.';
    const marks = alignVerses(text, [
      { ref: { chapter: 3, verse: 2 }, text: 'you have heard of the gift given to me' },
      { ref: { chapter: 3, verse: 3 }, text: 'and now I tell you more' },
    ]);
    expect(marks).toEqual([
      { at: 0, chapter: 3, verse: 2 },
      { at: text.indexOf('And now'), chapter: 3, verse: 3 },
    ]);
  });

  it('moves a verse back over the Lectionary’s own opening words', () => {
    const text = 'He said this.\nJesus said to his disciples, "Be ready always."';
    const marks = alignVerses(text, [
      { ref: { chapter: 1, verse: 1 }, text: 'He said this.' },
      { ref: { chapter: 1, verse: 2 }, text: 'He said to them, "Be ready always."' },
    ]);
    expect(marks[1].at).toBe(text.indexOf('Jesus'));
  });

  it('skips a verse the reading leaves out and a psalm refrain', () => {
    const text = 'R. Praise the Lord.\nThe heavens declare his glory.\nR. Praise the Lord.\nThe sea roars and the hills rejoice.';
    const marks = alignVerses(text, [
      { ref: { chapter: 19, verse: 2 }, text: 'The heavens declare the glory of God.' },
      { ref: { chapter: 19, verse: 3 }, text: 'Day unto day pours forth speech, night unto night knowledge.' },
      { ref: { chapter: 19, verse: 4 }, text: 'Let the sea roar, and the hills rejoice together.' },
    ]);
    expect(marks.map((m) => [m.verse, text.slice(m.at, m.at + 9)])).toEqual([
      [2, 'The heave'],
      [4, 'The sea r'],
    ]);
  });
});

describe('verseRuns and withVerseLabels', () => {
  const text = 'Alpha beta. Gamma delta. Epsilon.';
  const marks = [
    { at: 0, chapter: 9, verse: 35 },
    { at: 12, chapter: 9, verse: 36 },
    { at: 25, chapter: 10, verse: 1 },
  ];

  it('labels the first verse and a new chapter with chapter:verse, the rest with the verse', () => {
    expect(verseRuns(text, marks).map((r) => r.label)).toEqual(['9:35', '36', '10:1']);
    expect(withVerseLabels(text, marks)).toBe('[9:35] Alpha beta. [36] Gamma delta. [10:1] Epsilon.');
  });

  it('keeps the text whole, and gives it back unchanged without marks', () => {
    expect(verseRuns(text, marks).map((r) => r.text).join('')).toBe(text);
    expect(verseRuns(text, undefined)).toEqual([{ label: null, text }]);
    expect(verseRuns(text, [{ at: 99, chapter: 1, verse: 1 }])).toEqual([{ label: null, text }]);
  });

  it('keeps text before a first mark unlabeled', () => {
    expect(verseRuns('R. x\nWords', [{ at: 5, chapter: 1, verse: 1 }])).toEqual([
      { label: null, text: 'R. x\n' },
      { label: '1:1', text: 'Words' },
    ]);
  });
});

describe('addVerses', () => {
  const pages: Record<string, string> = {
    [bibleChapterUrl('ephesians', 3)]: bible('ephesians-3'),
    [bibleChapterUrl('psalms', 18)]: bible('psalms-18'),
    [bibleChapterUrl('matthew', 22)]: bible('matthew-22'),
  };
  const fetchText = vi.fn(async (url: string) => {
    if (pages[url]) return pages[url];
    throw new Error(`GET ${url} returned 403`);
  });
  const noSleep = async () => {};

  it('numbers every verse of a real Sunday Gospel and psalm', async () => {
    const { sections } = parseUsccb(usccb('sunday-2026-10-25'), '2026-10-25');
    const out = await addVerses(sections, fetchText, noSleep);
    const gospel = out.find((s) => s.kind === 'gospel')!;
    expect(gospel.text).toBe(sections.find((s) => s.kind === 'gospel')!.text);
    expect(withVerseLabels(gospel.text, gospel.verses).split('\n').slice(0, 5)).toEqual([
      '[22:34] When the Pharisees heard that Jesus had silenced the Sadducees,',
      'they gathered together, [35] and one of them,',
      'a scholar of the law tested him by asking,',
      '[36] "Teacher, which commandment in the law is the greatest?"',
      '[37] He said to him,',
    ]);
    const psalm = out.find((s) => s.kind === 'psalm')!;
    expect(psalm.verses?.map((v) => v.verse)).toEqual([2, 3, 4, 47, 51]);
    expect(psalm.text.slice(psalm.verses![0].at)).toMatch(/^I love you, O LORD/);
    // Verse 3 begins "LORD, my rock" in the Bible; the Lectionary line "O LORD, my rock" starts it.
    expect(psalm.text.slice(psalm.verses![1].at)).toMatch(/^O LORD, my rock/);
  });

  it('numbers a weekday first reading', async () => {
    const { sections } = parseUsccb(usccb('weekday-2026-10-21'), '2026-10-21');
    const [first] = await addVerses(sections.slice(0, 1), fetchText, noSleep);
    expect(first.verses?.map((v) => v.verse)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('leaves a section without verses when its chapter cannot be fetched or its citation read', async () => {
    const sections = [
      { kind: 'gospel' as const, title: 'Gospel', citation: 'Luke 12:39-48', text: 'Jesus said to his disciples' },
      { kind: 'sequence' as const, title: 'Sequence', citation: '', text: 'Christians, to the Paschal Victim' },
    ];
    expect(await addVerses(sections, fetchText, noSleep)).toEqual(sections);
  });

  it('keeps verses a section already has', async () => {
    const s = { kind: 'gospel' as const, title: 'G', citation: 'Matthew 22:34-40', text: 'x', verses: [{ at: 0, chapter: 1, verse: 1 }] };
    expect(await addVerses([s], fetchText, noSleep)).toEqual([s]);
  });
});
