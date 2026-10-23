import { beforeEach, describe, expect, it } from 'vitest';
import { isRetryable, resetModelHealth, withFallback } from '@/lib/ai/fallback';

const err = (status: number) => Object.assign(new Error(`status ${status}`), { status });

describe('withFallback', () => {
  beforeEach(() => resetModelHealth());

  it('uses the first model when it answers', async () => {
    const tried: string[] = [];
    const out = await withFallback(['a', 'b'], async (m) => (tried.push(m), m));
    expect(out).toBe('a');
    expect(tried).toEqual(['a']);
  });

  it('moves to the next model on 503 or 504 and skips the busy one afterwards', async () => {
    let t = 0;
    const tried: string[] = [];
    const call = async (m: string) => {
      tried.push(m);
      if (m === 'a') throw err(504);
      return m;
    };
    expect(await withFallback(['a', 'b'], call, () => t)).toBe('b');
    expect(await withFallback(['a', 'b'], call, () => t)).toBe('b');
    expect(tried).toEqual(['a', 'b', 'b']);
    t = 11 * 60_000;
    await withFallback(['a', 'b'], call, () => t);
    expect(tried.at(-2)).toBe('a');
  });

  it('tries at most two models per call', async () => {
    const tried: string[] = [];
    await expect(withFallback(['a', 'b', 'c'], async (m) => (tried.push(m), Promise.reject(err(503))))).rejects.toThrow(
      'status 503',
    );
    expect(tried).toEqual(['a', 'b']);
  });

  it('does not fall back on other errors', async () => {
    const tried: string[] = [];
    await expect(withFallback(['a', 'b'], async (m) => (tried.push(m), Promise.reject(err(400))))).rejects.toThrow();
    expect(tried).toEqual(['a']);
  });

  it('still tries the main model when every model is cooling off', async () => {
    await withFallback(['a', 'b'], async () => Promise.reject(err(503))).catch(() => {});
    const tried: string[] = [];
    await withFallback(['a', 'b'], async (m) => (tried.push(m), m));
    expect(tried).toEqual(['a']);
  });
});

describe('isRetryable', () => {
  it('reads status codes and Gemini status names', () => {
    expect(isRetryable(err(503))).toBe(true);
    expect(isRetryable(err(400))).toBe(false);
    expect(isRetryable(new Error('{"error":{"code":504,"status":"DEADLINE_EXCEEDED"}}'))).toBe(true);
    expect(isRetryable(new Error('bad json'))).toBe(false);
  });
});
