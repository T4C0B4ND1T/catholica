import { describe, expect, it } from 'vitest';
import { speakChunks } from '@/lib/speech';

const words = (s: string) => s.split(/\s+/).filter(Boolean);

describe('speakChunks', () => {
  it('returns nothing for blank text', () => {
    expect(speakChunks('  \n ')).toEqual([]);
  });

  it('keeps short text as one chunk', () => {
    expect(speakChunks('A reading from the Book of Isaiah.')).toEqual(['A reading from the Book of Isaiah.']);
  });

  it('splits on sentence ends and keeps every word, in order', () => {
    const text = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} is here, and it ends well.`).join(' ');
    const chunks = speakChunks(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(200);
    expect(chunks.flatMap(words)).toEqual(words(text));
    // chunks end at sentence ends
    for (const c of chunks) expect(c.endsWith('.')).toBe(true);
  });

  it('splits a long sentence between words, never mid-word', () => {
    const text = Array.from({ length: 120 }, (_, i) => `word${i}`).join(' ');
    const chunks = speakChunks(text);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(200);
    expect(chunks.flatMap(words)).toEqual(words(text));
  });

  it('keeps an over-long single word whole', () => {
    const long = 'x'.repeat(250);
    expect(speakChunks(`a ${long} b`, 200).flatMap(words)).toEqual(['a', long, 'b']);
  });

  it('treats newlines in verse as whitespace', () => {
    expect(speakChunks('The Lord is my shepherd;\nthere is nothing I lack.')).toEqual([
      'The Lord is my shepherd; there is nothing I lack.',
    ]);
  });

  it('honours a custom max', () => {
    for (const c of speakChunks('One two three. Four five six. Seven eight nine.', 16)) expect(c.length).toBeLessThanOrEqual(16);
  });
});
