import { describe, expect, it } from 'vitest';
import { parseQuestions } from '@/lib/ai/parse';

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
