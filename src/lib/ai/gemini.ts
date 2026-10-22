import 'server-only';
import { GoogleGenAI } from '@google/genai';
import type { DailyReadings } from '@/lib/types';
import { geminiModel } from './model';
import { parseQuestions } from './parse';


function promptFor(r: DailyReadings): string {
  const body = r.sections.map((s) => `${s.mass ? `${s.mass} · ` : ''}${s.title} (${s.citation})\n${s.text}`).join('\n\n');
  return [
    'Write a short reflection on the Mass readings below for a Catholic reader.',
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
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({ model: geminiModel(), contents: promptFor(r) });
  const text = res.text?.trim();
  if (!text) throw new Error('Gemini returned no text');
  return text;
}

/** Three or four questions to think about before Sunday Mass. Stored beside the reflection, shown under an AI label. */
export async function writeQuestions(r: DailyReadings): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const ai = new GoogleGenAI({ apiKey });
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

/** AI answer to a Catechism question. Shown only under an "AI answer" label, never as Catechism text. */
export async function askCatechism(question: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const ai = new GoogleGenAI({ apiKey });
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
