/**
 * Verse numbers for a reading. USCCB's Lectionary text carries no verse numbers, so they are found by lining the
 * reading up, word by word, against the same verses in USCCB's own Bible (NABRE), which numbers every verse. The
 * reading's words are never changed: a verse number is only a position in the text where that verse begins.
 * Pure functions only; fetching the Bible chapters lives in `sources/bible.ts`.
 */
import type { VerseMark } from '@/lib/types';

/** One verse a citation names, in the order it names them. */
export interface VerseRef {
  chapter: number;
  verse: number;
}

export interface ParsedCitation {
  /** USCCB's Bible slug for the book, e.g. "1corinthians". */
  book: string;
  refs: VerseRef[];
}

/** Book names as citations spell them (and a few misspellings USCCB has published) mapped to USCCB Bible slugs. */
const BOOKS: Record<string, string> = {
  genesis: 'genesis', exodus: 'exodus', leviticus: 'leviticus', numbers: 'numbers', deuteronomy: 'deuteronomy',
  joshua: 'joshua', judges: 'judges', ruth: 'ruth', '1 samuel': '1samuel', '2 samuel': '2samuel',
  '1 kings': '1kings', '2 kings': '2kings', '1 chronicles': '1chronicles', '2 chronicles': '2chronicles',
  ezra: 'ezra', nehemiah: 'nehemiah', tobit: 'tobit', judith: 'judith', esther: 'esther',
  '1 maccabees': '1maccabees', '2 maccabees': '2maccabees', job: 'job', psalm: 'psalms', psalms: 'psalms',
  proverbs: 'proverbs', ecclesiastes: 'ecclesiastes', 'song of songs': 'songofsongs', wisdom: 'wisdom',
  sirach: 'sirach', sirarch: 'sirach', isaiah: 'isaiah', jeremiah: 'jeremiah', lamentations: 'lamentations',
  baruch: 'baruch', ezekiel: 'ezekiel', daniel: 'daniel', hosea: 'hosea', joel: 'joel', amos: 'amos',
  obadiah: 'obadiah', jonah: 'jonah', micah: 'micah', nahum: 'nahum', habakkuk: 'habakkuk', zephaniah: 'zephaniah',
  haggai: 'haggai', zechariah: 'zechariah', malachi: 'malachi', matthew: 'matthew', mark: 'mark', luke: 'luke',
  john: 'john', acts: 'acts', romans: 'romans', '1 corinthians': '1corinthians', '2 corinthians': '2corinthians',
  galatians: 'galatians', ephesians: 'ephesians', philippians: 'philippians', phiippians: 'philippians',
  phippians: 'philippians', colossians: 'colossians', '1 thessalonians': '1thessalonians',
  '2 thessalonians': '2thessalonians', '1 timothy': '1timothy', '2 timothy': '2timothy', titus: 'titus',
  philemon: 'philemon', hebrews: 'hebrews', james: 'james', '1 peter': '1peter', '2 peter': '2peter',
  '1 john': '1john', '2 john': '2john', '3 john': '3john', jude: 'jude', revelation: 'revelation',
};

/** Books of a single chapter, cited by verse alone ("Philemon 7-20"). */
const ONE_CHAPTER = new Set(['obadiah', 'philemon', '2john', '3john', 'jude']);

/** No reading is anywhere near this long; a bigger range means the citation was misread. */
const MAX_VERSES = 400;

/**
 * Reads a citation such as "Isaiah 63:16b-17, 19b; 64:2-7", "Matthew 9:35–10:1, 5a, 6-8" or "See Luke 19:38; 2:14"
 * into its book and verses, in the order cited, each verse once. Verse letters ("16b") are dropped. "or" names a
 * shorter form of the same reading, so its verses are added after the first form's. Returns null for anything it
 * cannot read (a missing book, Esther's lettered chapters, a sequence's title).
 */
export function parseCitation(citation: string): ParsedCitation | null {
  let s = citation
    .replace(/\(.*?\)/g, ' ')
    .replace(/[‐-―]/g, '-')
    .replace(/&/g, ',')
    .replace(/\band\b/gi, ',')
    .replace(/\bor\b/gi, ';')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.\s]+$/, '');
  s = s.replace(/^(see|cf\.?)\s+/i, '');
  const m = /^((?:[1-3]\s*)?[a-z]+(?:\s+of\s+[a-z]+)?)\s*(\d.*)$/i.exec(s);
  if (!m) return null;
  const name = m[1].toLowerCase().replace(/^([1-3])\s*/, '$1 ');
  const book = BOOKS[name];
  if (!book) return null;
  const rest = m[2].replace(/\s+/g, '');
  const oneChapter = ONE_CHAPTER.has(book);

  const refs: VerseRef[] = [];
  const seen = new Set<string>();
  const add = (chapter: number, verse: number) => {
    const k = `${chapter}:${verse}`;
    if (seen.has(k)) return;
    seen.add(k);
    refs.push({ chapter, verse });
  };
  // A point is "ch:v" or "v" (in the current chapter); letters after a verse number are parts of it.
  const point = /^(?:(\d+):)?(\d+)[a-z]*$/i;
  let chapter = oneChapter ? 1 : NaN;

  for (const group of rest.split(';').filter(Boolean)) {
    let first = true;
    for (const piece of group.split(',').filter(Boolean)) {
      const [a, b, ...extra] = piece.split('-').filter(Boolean);
      if (!a || extra.length) return null;
      const pa = point.exec(a);
      if (!pa) return null;
      if (pa[1]) chapter = Number(pa[1]);
      // A group after ";" must name its chapter, except in a one-chapter book.
      else if (first && refs.length && !oneChapter) return null;
      if (Number.isNaN(chapter)) return null;
      const startCh = chapter;
      const startV = Number(pa[2]);
      if (!b) {
        add(startCh, startV);
      } else {
        const pb = point.exec(b);
        if (!pb) return null;
        const endCh = pb[1] ? Number(pb[1]) : startCh;
        const endV = Number(pb[2]);
        if (endCh === startCh) {
          if (endV < startV || endV - startV > MAX_VERSES) return null;
          for (let v = startV; v <= endV; v++) add(startCh, v);
        } else {
          // Across a chapter break: every verse to the end of the first chapter, which the Bible text supplies.
          if (endCh < startCh || endCh - startCh > 3) return null;
          for (let v = startV; v <= startV + MAX_VERSES / 2; v++) add(startCh, v);
          for (let c = startCh + 1; c < endCh; c++) for (let v = 1; v <= MAX_VERSES / 2; v++) add(c, v);
          for (let v = 1; v <= endV; v++) add(endCh, v);
          chapter = endCh;
        }
      }
      first = false;
    }
  }
  if (!refs.length || refs.length > MAX_VERSES * 2) return null;
  return { book, refs };
}

interface Token {
  word: string;
  start: number;
}

/** Words lowercased with apostrophes and accents dropped, with where each starts in `text`. */
export function tokenize(text: string, from = 0, to = text.length): Token[] {
  const out: Token[] = [];
  const re = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu;
  re.lastIndex = from;
  for (let m = re.exec(text); m && m.index < to; m = re.exec(text)) {
    const word = m[0]
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/['’]/g, '')
      .toLowerCase();
    out.push({ word, start: m.index });
  }
  return out;
}

/** Lines of a reading that are not the reading itself: a psalm's "R." refrain, the Alleluia acclamation. */
const NOT_SCRIPTURE = /^(R\.|Alleluia, alleluia\b)/i;

/** The reading's own words, with refrain and acclamation lines left out. */
function readingTokens(text: string): Token[] {
  const out: Token[] = [];
  let at = 0;
  for (const line of text.split('\n')) {
    if (!NOT_SCRIPTURE.test(line.trim())) out.push(...tokenize(text, at, at + line.length));
    at += line.length + 1;
  }
  return out;
}

/** Moves a verse start back over an opening quotation mark or bracket right before its first word. */
function openingStart(text: string, at: number): number {
  while (at > 0 && /["“‘'(\[]/.test(text[at - 1])) at--;
  return at;
}

/** How many unmatched words a verse start may move back to begin its line. */
const SNAP_WORDS = 3;

/** Below this share of a verse's words found in the reading, the verse is taken to be left out of it. */
const MIN_SHARE = 0.34;

/**
 * Where each verse begins in `text`. `verses` holds the Bible text of the cited verses, in citation order. The reading
 * and the verses are lined up word by word (longest common subsequence). A verse is marked where its first matched
 * word falls; when the verse's opening words differ in the reading (the Lectionary often opens with "At that time"
 * or names the speaker), the mark moves back over the reading's unmatched words before it. A verse with too few of
 * its words in the reading gets no mark. The first marked verse always starts at the reading's first word.
 */
export function alignVerses(text: string, verses: { ref: VerseRef; text: string }[]): VerseMark[] {
  const a = readingTokens(text);
  const b: { word: string; verse: number; pos: number }[] = [];
  verses.forEach((v, i) => tokenize(v.text).forEach((t, pos) => b.push({ word: t.word, verse: i, pos })));
  const n = a.length;
  const m = b.length;
  if (!n || !m) return [];

  // LCS table, row-major (n+1) x (m+1).
  const w = m + 1;
  const dp = new Uint16Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] =
        a[i].word === b[j].word ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
  }
  // matchOf[j] = the reading token matched to Bible token j, or -1.
  const matchOf = new Int32Array(m).fill(-1);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (a[i].word === b[j].word) {
      matchOf[j] = i;
      i++;
      j++;
    } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) i++;
    else j++;
  }

  const marks: VerseMark[] = [];
  let lastMatched = -1; // reading token index of the previous verse's last match
  let j = 0;
  for (let vi = 0; vi < verses.length; vi++) {
    let count = 0;
    let firstA = -1;
    let firstPos = 0;
    let lastA = -1;
    const start = j;
    for (; j < m && b[j].verse === vi; j++) {
      if (matchOf[j] < 0) continue;
      count++;
      if (firstA < 0) {
        firstA = matchOf[j];
        firstPos = b[j].pos;
      }
      lastA = matchOf[j];
    }
    const size = j - start;
    if (!size || firstA < 0 || count < Math.min(2, size) || count / size < MIN_SHARE) continue;
    const gap = firstA - lastMatched - 1;
    let at = firstA - Math.min(firstPos, gap);
    // A verse that starts a few unmatched words into a line ("O LORD" for "LORD") starts with the line.
    for (let k = at; k > lastMatched && at - k <= SNAP_WORDS; k--) {
      if (k === 0 || text.slice(a[k - 1].start, a[k].start).includes('\n')) {
        at = k;
        break;
      }
    }
    if (!marks.length) at = 0;
    const { chapter, verse } = verses[vi].ref;
    marks.push({ at: openingStart(text, a[at].start), chapter, verse });
    lastMatched = lastA;
  }
  // Two verses landing on the same word: keep the later one only when the earlier has no words of its own.
  return marks.filter((mk, i) => i === marks.length - 1 || marks[i + 1].at !== mk.at);
}

/** A reading's text cut into runs, each starting at a verse mark (or the text start), for rendering. */
export interface VerseRun {
  /** The label to show before the run ("3:2", "5"), or null for text before the first mark. */
  label: string | null;
  text: string;
}

/**
 * Splits `text` at its verse marks. The first mark and every mark whose chapter differs from the one before it are
 * labeled "chapter:verse"; the rest show the verse alone.
 */
export function verseRuns(text: string, marks: VerseMark[] | undefined): VerseRun[] {
  const ok = (marks ?? []).filter((mk, i, all) => mk.at >= 0 && mk.at < text.length && (i === 0 || mk.at > all[i - 1].at));
  if (!ok.length) return [{ label: null, text }];
  const runs: VerseRun[] = [];
  if (ok[0].at > 0) runs.push({ label: null, text: text.slice(0, ok[0].at) });
  ok.forEach((mk, i) => {
    const prev = ok[i - 1];
    const label = !prev || prev.chapter !== mk.chapter ? `${mk.chapter}:${mk.verse}` : String(mk.verse);
    runs.push({ label, text: text.slice(mk.at, ok[i + 1]?.at ?? text.length) });
  });
  return runs;
}

/** The text with verse labels inline in brackets ("[3:2] Brothers and sisters ... [3] the mystery ..."), for plain text. */
export function withVerseLabels(text: string, marks: VerseMark[] | undefined): string {
  return verseRuns(text, marks)
    .map((r) => (r.label ? `[${r.label}] ${r.text}` : r.text))
    .join('');
}
