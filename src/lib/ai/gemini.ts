import 'server-only';
import { GoogleGenAI } from '@google/genai';
import type { DailyReadings } from '@/lib/types';
import { geminiModel } from './model';


function promptFor(r: DailyReadings): string {
  const body = r.sections.map((s) => `${s.title} (${s.citation})\n${s.text}`).join('\n\n');
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
