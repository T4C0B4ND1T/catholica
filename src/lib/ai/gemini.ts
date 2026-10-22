import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { fetchCatechism } from '@/lib/sources/catechism';
import type { BulletinSummary, DailyReadings, ReflectionInsights } from '@/lib/types';
import { geminiModel } from './model';
import { parseBulletinSummary, parseInsights, parseQuestions } from './parse';

/** Gemini can hang for most of a minute when busy; give up sooner so a cron run stays inside its time limit. */
const TIMEOUT_MS = 40_000;


function promptFor(r: DailyReadings): string {
  const body = r.sections.map((s) => `${s.mass ? `${s.mass} · ` : ''}${s.title} (${s.citation})\n${s.text}`).join('\n\n');
  return [
    'Write a short homiletic reflection on the Mass readings below for a Catholic reader, as a priest might preach it.',
    'Rules: 150 to 220 words. Speak to the reader in the second person. Use plain language.',
    'Quote only words that appear in the readings given. Do not cite any Scripture passage that is not listed below.',
    'Do not add headings, lists, or a title. Output the reflection text only.',
    '',
    `Date: ${r.date}`,
    r.feast ? `Feast: ${r.feast}` : '',
    '',
    body,
  ].join('\n');
}

/** AI reflection for the day. Stored only in `reflections`, never in a readings field. */
export async function writeReflection(r: DailyReadings): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: TIMEOUT_MS } });
  const res = await ai.models.generateContent({ model: geminiModel(), contents: promptFor(r) });
  const text = res.text?.trim();
  if (!text) throw new Error('Gemini returned no text');
  return text;
}

/**
 * The biblical theology insight, Catechism connections and prayer prompt for the day. Only Catechism paragraphs that
 * exist at the source are kept, so every connection opens real Catechism text.
 */
export async function writeInsights(r: DailyReadings): Promise<ReflectionInsights> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: TIMEOUT_MS } });
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
  const res = await ai.models.generateContent({
    model: geminiModel(),
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });
  const insights = parseInsights(res.text ?? '');
  const real = await Promise.all(
    insights.catechism.map((c) => fetchCatechism(c.paragraph).then((p) => (p ? c : null), () => null)),
  );
  return { ...insights, catechism: real.filter((c) => c !== null) };
}

/** Three or four questions to think about before Sunday Mass. Stored beside the reflection, shown under an AI label. */
export async function writeQuestions(r: DailyReadings): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: TIMEOUT_MS } });
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
  const res = await ai.models.generateContent({
    model: geminiModel(),
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });
  return parseQuestions(res.text ?? '');
}

/** Bulletin text past this is mostly advertisers; the schedule and news come first. */
const BULLETIN_TEXT_LIMIT = 60_000;

/** Mass and confession times and this week's announcements, read by AI from the bulletin's extracted text. */
export async function summarizeBulletin(text: string): Promise<BulletinSummary> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: TIMEOUT_MS } });
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
  const res = await ai.models.generateContent({
    model: geminiModel(),
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });
  return parseBulletinSummary(res.text ?? '');
}

/** AI answer to a Catechism question. Shown only under an "AI answer" label, never as Catechism text. */
export async function askCatechism(question: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: TIMEOUT_MS } });
  const prompt = [
    'Answer the question below for a Catholic reader, based on the Catechism of the Catholic Church.',
    'Rules: at most 150 words, plain language, no headings or lists.',
    'Cite the relevant paragraph numbers in the form CCC 1324 (for several, write CCC 1324 and CCC 1325 separately).',
    'Do not quote the Catechism or Scripture word for word; paraphrase. Only cite paragraphs you are confident exist.',
    'If the question is not about Catholic teaching, say so briefly.',
    '',
    `Question: ${question}`,
  ].join('\n');
  const res = await ai.models.generateContent({ model: geminiModel(), contents: prompt });
  const text = res.text?.trim();
  if (!text) throw new Error('Gemini returned no text');
  return text;
}
