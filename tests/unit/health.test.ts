import { describe, expect, it } from 'vitest';
import { healthProblems, type HealthReport } from '@/lib/health';

const NOW = new Date('2026-10-23T18:00:00Z');
const TODAY = '2026-10-23';

function report(over: Partial<HealthReport> = {}): HealthReport {
  return {
    jobs: [
      { job: 'readings', last: { at: '2026-10-23T10:01:00Z', status: 'ok', message: 'saved 1' }, lastOk: '2026-10-23T10:01:00Z' },
      { job: 'bulletin', last: { at: '2026-10-23T11:01:00Z', status: 'ok', message: '' }, lastOk: '2026-10-23T11:01:00Z' },
      { job: 'sunday-email', last: null, lastOk: null },
    ],
    days: [
      { date: '2026-10-22', readings: true, reflection: true, insights: true, questions: null },
      { date: '2026-10-23', readings: true, reflection: true, insights: true, questions: null },
      { date: '2026-10-25', readings: true, reflection: true, insights: true, questions: true },
    ],
    bulletin: { sundayDate: '2026-10-18', summary: true, pdf: true },
    model: 'openai/gpt-5-mini',
    fallbacks: [],
    ...over,
  };
}

describe('healthProblems', () => {
  it('is empty when all is well', () => {
    expect(healthProblems(report(), TODAY, NOW)).toEqual([]);
  });

  it('names stale jobs, missing days, questions, summary and a failed email', () => {
    const r = report({
      jobs: [
        { job: 'readings', last: { at: '2026-10-21T10:00:00Z', status: 'error', message: 'x' }, lastOk: '2026-10-21T10:00:00Z' },
        { job: 'bulletin', last: null, lastOk: null },
        { job: 'sunday-email', last: { at: '2026-10-17T13:00:00Z', status: 'error', message: 'not sent (email not set up) for 2026-10-18' }, lastOk: null },
      ],
      days: [
        { date: '2026-10-22', readings: true, reflection: false, insights: false, questions: null },
        { date: '2026-10-24', readings: false, reflection: false, insights: false, questions: null },
        { date: '2026-10-25', readings: true, reflection: true, insights: true, questions: false },
      ],
      bulletin: { sundayDate: '2026-10-18', summary: false, pdf: true },
    });
    const p = healthProblems(r, TODAY, NOW);
    expect(p).toHaveLength(7);
    expect(p.join('\n')).toMatch(/Saturday email wasn't sent/);
    expect(p).toContain('Readings missing for Sat, Oct 24, 2026.');
    expect(p).toContain('Reflection missing for Thu, Oct 22, 2026.');
    expect(p).toContain('Sunday questions missing for Sun, Oct 25, 2026.');
  });
});
