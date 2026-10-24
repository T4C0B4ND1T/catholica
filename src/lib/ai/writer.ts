import 'server-only';
import { generateText } from 'ai';
import { fetchCatechism } from '@/lib/sources/catechism';
import { studyGroups } from '@/lib/study';
import type { BulletinSummary, DailyReadings, ReadingStudy, ReflectionInsights, StudyGuide, StudyLevel } from '@/lib/types';
import { aiFallbackModels, aiModel } from './model';
import { parseBulletinSummary, parseInsights, parseQuestions, parseStudy } from './parse';

/** Give up on a slow answer so a cron run stays inside its time limit. AI Gateway's fallback model shares this budget. */
const TIMEOUT_MS = 60_000;

/**
 * One AI call through Vercel AI Gateway. On Vercel the gateway authenticates with the deployment's OIDC token, so no
 * key is needed there; elsewhere set AI_GATEWAY_API_KEY.
 */
async function generate(prompt: string, opts: { long?: boolean } = {}): Promise<string> {
  const model = aiModel();
  const { text } = await generateText({
    model,
    prompt,
    timeout: TIMEOUT_MS,
    maxRetries: 1,
    providerOptions: {
      gateway: { models: aiFallbackModels() },
      // Long answers: GPT-5 models think less so the writing fits in the timeout. Other models ignore this key.
      ...(opts.long && model.startsWith('openai/gpt-5') ? { openai: { reasoningEffort: 'low' } } : {}),
    },
  });
  return text;
}

function promptFor(r: DailyReadings): string {
  const body = r.sections.map((s) => `${s.mass ? `${s.mass} · ` : ''}${s.title} (${s.citation})\n${s.text}`).join('\n\n');
  return [
    'Write a short homily on the Mass readings below for a Catholic reader, as a priest might preach it.',
    'Rules: 150 to 220 words. Speak to the reader in the second person. Use plain language.',
    'Draw the readings together into one message the reader can carry through the day.',
    'Quote only words that appear in the readings given. Do not cite any Scripture passage that is not listed below.',
    'Do not add headings, lists, or a title. Output the reflection text only.',
    '',
    `Date: ${r.date}`,
    r.feast ? `Feast: ${r.feast}` : '',
    '',
    body,
  ].join('\n');
}

/** The day's short homily (the `reflections.text` column). Stored only in `reflections`, never in a readings field. */
export async function writeReflection(r: DailyReadings): Promise<string> {
  const text = (await generate(promptFor(r))).trim();
  if (!text) throw new Error('The AI model returned no text');
  return text;
}

/**
 * The biblical theology insight, Catechism connections and prayer prompt for the day. Only Catechism paragraphs that
 * exist at the source are kept, so every connection opens real Catechism text.
 */
export async function writeInsights(r: DailyReadings): Promise<ReflectionInsights> {
  const body = r.sections.map((s) => `${s.mass ? `${s.mass} · ` : ''}${s.title} (${s.citation})\n${s.text}`).join('\n\n');
  const prompt = [
    'From the Mass readings below, write study notes for a Catholic reader. Return JSON with exactly these keys:',
    '"theology": a biblical theology insight, 80 to 120 words: how these readings connect across the Old and New',
    'Testament (a theme, promise, type or covenant thread). Plain language. Name any other passage you mention by book',
    'and chapter only, and do not quote it.',
    '"catechism": two or three items {"paragraph": a Catechism of the Catholic Church paragraph number, "connection":',
    'one sentence on how that paragraph relates to these readings}. Only use paragraph numbers you are confident exist',
    'and fit; do not quote the Catechism.',
    '"prayer": a prayer prompt, 40 to 70 words, in the second person, inviting the reader into prayer from one image or',
    'line in the readings.',
    'Quote only words that appear in the readings given.',
    '',
    `Date: ${r.date}`,
    r.feast ? `Feast: ${r.feast}` : '',
    '',
    body,
  ].join('\n');
  const insights = parseInsights(await generate(prompt));
  const real = await Promise.all(
    insights.catechism.map((c) => fetchCatechism(c.paragraph).then((p) => (p ? c : null), () => null)),
  );
  return { ...insights, catechism: real.filter((c) => c !== null) };
}

/** Three or four questions to think about before Sunday Mass. Stored beside the reflection, shown under an AI label. */
export async function writeQuestions(r: DailyReadings): Promise<string[]> {
  const body = r.sections.map((s) => `${s.mass ? `${s.mass} · ` : ''}${s.title} (${s.citation})\n${s.text}`).join('\n\n');
  const prompt = [
    'Write questions for a Catholic reader to think and pray about while preparing for Sunday Mass, from the readings below.',
    'Rules: three or four questions, each one sentence, plain language, second person.',
    'Each question should point to something specific in the readings. Quote only words that appear in them.',
    'Output a JSON array of strings and nothing else.',
    '',
    `Date: ${r.date}`,
    r.feast ? `Feast: ${r.feast}` : '',
    '',
    body,
  ].join('\n');
  return parseQuestions(await generate(prompt));
}

const STUDY_RULES: Record<StudyLevel, string[]> = {
  brief: [
    '"context": {"who", "when", "where", "why"}, one short sentence each.',
    '"explanation": 50 to 80 words on what the passage says and means.',
    '"reflection": 30 to 50 words, second person, on what it asks of the reader today.',
  ],
  full: [
    '"context": {"who", "when", "where", "why"}, one to three sentences each.',
    '"explanation": 120 to 180 words walking through the passage: its key words and images, how it unfolds, and',
    'what it meant for its first hearers.',
    '"reflection": 60 to 100 words, second person, on what it asks of the reader this week.',
  ],
};

/** Study notes for the readings of one Mass. `items` carry each reading's index in the day's sections. */
async function writeMassStudy(
  r: DailyReadings,
  mass: string | null,
  items: { index: number; section: DailyReadings['sections'][number] }[],
  level: StudyLevel,
): Promise<ReadingStudy[]> {
  const body = items.map(({ index, section: s }) => `[${index}] ${s.title} (${s.citation})\n${s.text}`).join('\n\n');
  const prompt = [
    'Write a study guide on the Mass readings below for a Catholic reader who wants to understand them.',
    'Return a JSON array with one object per reading, in the order given, each with exactly these keys:',
    '"index": the number in square brackets before the reading.',
    ...STUDY_RULES[level],
    'Context covers who wrote or speaks in the text and to whom, when it was written or set, where, and why (the',
    'situation it answers). For a psalm, say who prays it and how it answers the reading before it.',
    'Plain language, the tone of a good study Bible. Follow Catholic teaching. Quote only words that appear in the',
    'readings given. Name any other passage by book and chapter only. Where scholars are unsure (author, date), say so.',
    'Output the JSON array only.',
    '',
    `Date: ${r.date}`,
    r.feast ? `Feast: ${r.feast}` : '',
    mass ? `Mass: ${mass}` : '',
    '',
    body,
  ].join('\n');
  return parseStudy(
    await generate(prompt, { long: true }),
    items.map((i) => i.index),
  );
}

/**
 * The study guide for the day: context, explanation and reflection for each First Reading, Psalm, Second Reading and
 * Gospel, for every Mass of the day (one AI call per Mass). Throws when any Mass fails, so the next run tries again.
 */
export async function writeStudy(r: DailyReadings, level: StudyLevel): Promise<StudyGuide> {
  const groups = studyGroups(r.sections);
  if (groups.length === 0) throw new Error('No readings to study');
  const readings: ReadingStudy[] = [];
  for (const g of groups) readings.push(...(await writeMassStudy(r, g.mass, g.items, level)));
  return { level, readings };
}

/** What the personal reflection draws on. Notes and intentions are the reader's own words. */
export interface PersonalInput {
  readings: DailyReadings;
  level: StudyLevel;
  homily: string | null;
  /** The reader's notes, newest first: the day's own note, then recent ones. */
  notes: { date: string; body: string }[];
  /** Prayer intentions not yet marked answered. */
  intentions: string[];
}

/** A reflection written for one reader from the day's readings, their recent notes and their open intentions. */
export async function writePersonal(p: PersonalInput): Promise<string> {
  const readings = studyGroups(p.readings.sections)
    .flatMap((g) => g.items)
    .map(({ section: s }) => `${s.mass ? `${s.mass} · ` : ''}${s.title} (${s.citation})\n${s.text}`)
    .join('\n\n');
  const notes = p.notes.map((n) => `(${n.date}) ${n.body}`).join('\n');
  const intentions = p.intentions.map((t) => `- ${t}`).join('\n');
  const prompt = [
    'Write a short personal reflection for one Catholic reader on the Mass readings below, connecting them to what the',
    'reader has written in their own notes and to the intentions they are praying for.',
    p.level === 'full' ? 'Rules: 150 to 250 words.' : 'Rules: 80 to 130 words.',
    'Second person, warm and plain, like a spiritual director who has read their journal. Name one or two specific',
    'links between a reading and the reader\'s notes or intentions, and end with one concrete thing to pray about.',
    'Do not repeat the notes back at length, do not diagnose or give medical, legal or financial advice, and do not',
    'invent details about the reader\'s life. If the notes and intentions are empty, reflect on the readings alone.',
    'Quote only words that appear in the readings given. No headings or lists. Output the reflection text only.',
    '',
    `Date: ${p.readings.date}`,
    p.readings.feast ? `Feast: ${p.readings.feast}` : '',
    '',
    'READER\'S NOTES (newest first):',
    notes || '(none)',
    '',
    'READER\'S INTENTIONS:',
    intentions || '(none)',
    '',
    p.homily ? `TODAY'S HOMILY (for reference, do not repeat it):\n${p.homily}\n` : '',
    'READINGS:',
    readings,
  ].join('\n');
  const text = (await generate(prompt)).trim();
  if (!text) throw new Error('The AI model returned no text');
  return text;
}

/** Bulletin text past this is mostly advertisers; the schedule and news come first. */
const BULLETIN_TEXT_LIMIT = 60_000;

/** Mass and confession times and this week's announcements, read by AI from the bulletin's extracted text. */
export async function summarizeBulletin(text: string): Promise<BulletinSummary> {
  const prompt = [
    'Below is the text of a Catholic parish bulletin, extracted from its PDF (layout lost, so columns may be mixed).',
    'Return JSON with exactly these keys:',
    '"massTimes": the weekend and weekday Mass schedule, one string per line, like "Saturday 4:00 PM (Vigil)".',
    '"confession": confession times, one string per line.',
    '"announcements": this week\'s news and events (not advertisements, not staff lists), at most 8, each {"title", "text"},',
    'with text of one or two sentences that keeps any date, time and place exactly as written.',
    'Use only what the text says. Leave a list empty when the text does not have it.',
    '',
    text.slice(0, BULLETIN_TEXT_LIMIT),
  ].join('\n');
  return parseBulletinSummary(await generate(prompt));
}

/** AI answer to a Catechism question. Shown only under an "AI answer" label, never as Catechism text. */
export async function askCatechism(question: string): Promise<string> {
  const prompt = [
    'Answer the question below for a Catholic reader, based on the Catechism of the Catholic Church.',
    'Rules: at most 150 words, plain language, no headings or lists.',
    'Cite the relevant paragraph numbers in the form CCC 1324 (for several, write CCC 1324 and CCC 1325 separately).',
    'Do not quote the Catechism or Scripture word for word; paraphrase. Only cite paragraphs you are confident exist.',
    'If the question is not about Catholic teaching, say so briefly.',
    '',
    `Question: ${question}`,
  ].join('\n');
  const text = (await generate(prompt)).trim();
  if (!text) throw new Error('The AI model returned no text');
  return text;
}
