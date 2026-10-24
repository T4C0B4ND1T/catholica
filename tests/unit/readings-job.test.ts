import { describe, expect, it, vi } from 'vitest';
import { runReadingsJob, type ReadingsJobDeps } from '@/lib/jobs/readings-job';
import type { DailyReadings, StudyLevel } from '@/lib/types';

// 2026-10-21 12:00 Chicago (CDT) = 17:00 UTC
const NOW = new Date('2026-10-21T17:00:00Z');
const DATES = ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28'];

const mk = (date: string): DailyReadings => ({
  date, feast: 'F', lectionary: '1', sections: [], sourceUrl: 'u', fetchedAt: NOW.toISOString(),
});

function setup(over: Partial<ReadingsJobDeps> = {}, stored: string[] = [], reflected: string[] = []) {
  const db = new Map(stored.map((d) => [d, mk(d)]));
  const refl = new Set(reflected);
  const deps = {
    fetchUsccb: vi.fn(async (d: string) => mk(d)),
    getReadings: vi.fn(async (d: string) => db.get(d) ?? null),
    saveReadings: vi.fn(async (r: DailyReadings) => void db.set(r.date, r)),
    saveReflection: vi.fn(async (d: string) => void refl.add(d)),
    hasReflection: vi.fn(async (d: string) => refl.has(d)),
    writeReflection: vi.fn(async () => 'reflection'),
    logRun: vi.fn(async () => {}),
    alert: vi.fn(async () => {}),
    now: NOW,
    sleep: vi.fn(async () => {}),
    ...over,
  } satisfies ReadingsJobDeps;
  return deps;
}

describe('runReadingsJob', () => {
  it('fetches missing dates today..+7 and skips stored ones', async () => {
    const deps = setup({}, ['2026-10-21', '2026-10-22']);
    const res = await runReadingsJob(deps);
    expect(res.saved).toEqual(DATES.slice(2));
    expect(res.failed).toEqual([]);
    expect(deps.fetchUsccb).toHaveBeenCalledTimes(6);
    expect(deps.fetchUsccb).not.toHaveBeenCalledWith('2026-10-21');
    expect(deps.alert).not.toHaveBeenCalled();
    expect(deps.logRun).toHaveBeenCalledWith('readings', 'ok', expect.any(String));
  });

  it('gives up on a date after 3 attempts', async () => {
    const deps = setup({
      fetchUsccb: vi.fn(async (d: string) => {
        if (d === '2026-10-26') throw new Error('boom');
        return mk(d);
      }),
    });
    const res = await runReadingsJob(deps);
    expect(res.failed).toEqual(['2026-10-26']);
    expect(res.saved).toHaveLength(7);
    expect(vi.mocked(deps.fetchUsccb).mock.calls.filter(([d]: [string]) => d === '2026-10-26')).toHaveLength(3);
    expect(deps.logRun).toHaveBeenCalledWith('readings', 'error', expect.stringContaining('2026-10-26'));
  });

  it('recovers when a later attempt succeeds', async () => {
    let n = 0;
    const deps = setup({
      fetchUsccb: vi.fn(async (d: string) => {
        if (d === '2026-10-21' && ++n < 3) throw new Error('flaky');
        return mk(d);
      }),
    });
    const res = await runReadingsJob(deps);
    expect(res.failed).toEqual([]);
    expect(res.saved).toContain('2026-10-21');
  });

  it('alerts exactly once when today and tomorrow both fail', async () => {
    const deps = setup({
      fetchUsccb: vi.fn(async (d: string) => {
        if (d <= '2026-10-22') throw new Error('down');
        return mk(d);
      }),
    });
    await runReadingsJob(deps);
    expect(deps.alert).toHaveBeenCalledTimes(1);
  });

  it('does not alert when only tomorrow fails (the feed has no future days)', async () => {
    const deps = setup({
      fetchUsccb: vi.fn(async (d: string) => {
        if (d === '2026-10-22') throw new Error('down');
        return mk(d);
      }),
    });
    await runReadingsJob(deps);
    expect(deps.alert).not.toHaveBeenCalled();
  });

  it('does not alert when only day +5 fails', async () => {
    const deps = setup({
      fetchUsccb: vi.fn(async (d: string) => {
        if (d === '2026-10-26') throw new Error('down');
        return mk(d);
      }),
    });
    await runReadingsJob(deps);
    expect(deps.alert).not.toHaveBeenCalled();
  });

  it('keeps readings and does not alert when the reflection fails', async () => {
    const deps = setup({ writeReflection: vi.fn(async () => { throw new Error('gemini down'); }) });
    const res = await runReadingsJob(deps);
    expect(res.saved).toEqual(DATES);
    expect(res.failed).toEqual([]);
    expect(deps.saveReadings).toHaveBeenCalledTimes(8);
    expect(deps.saveReflection).not.toHaveBeenCalled();
    expect(deps.alert).not.toHaveBeenCalled();
  });

  it('writes each reflection once across runs', async () => {
    const deps = setup();
    await runReadingsJob(deps);
    await runReadingsJob(deps);
    expect(deps.writeReflection).toHaveBeenCalledTimes(8);
    expect(deps.saveReflection).toHaveBeenCalledTimes(8);
  });

  it('writes a missing reflection for already-stored readings', async () => {
    const deps = setup({}, DATES, DATES.slice(1));
    await runReadingsJob(deps);
    expect(deps.fetchUsccb).not.toHaveBeenCalled();
    expect(deps.saveReflection).toHaveBeenCalledTimes(1);
    expect(deps.saveReflection).toHaveBeenCalledWith('2026-10-21', 'reflection');
  });

  it('backs off 1s then 3s between attempts', async () => {
    const deps = setup({
      fetchUsccb: vi.fn(async (d: string) => {
        if (d === '2026-10-28') throw new Error('down');
        return mk(d);
      }),
    });
    await runReadingsJob(deps);
    expect(vi.mocked(deps.sleep).mock.calls).toEqual([[1000], [3000]]);
  });

  it('stops starting new dates once the time budget is exceeded', async () => {
    let t = 0;
    const deps = setup({
      clock: () => t,
      budgetMs: 100,
      fetchUsccb: vi.fn(async (d: string) => {
        t += 60;
        return mk(d);
      }),
    });
    const res = await runReadingsJob(deps);
    expect(res.saved).toEqual(DATES.slice(0, 2));
    expect(res.failed).toEqual(DATES.slice(2));
    expect(deps.fetchUsccb).toHaveBeenCalledTimes(2);
    expect(deps.alert).not.toHaveBeenCalled();
  });

  it('starts from the Chicago date when UTC has already rolled over', async () => {
    const deps = setup({ now: new Date('2026-10-22T03:00:00Z') });
    await runReadingsJob(deps);
    expect(vi.mocked(deps.getReadings).mock.calls[0][0]).toBe('2026-10-21');
    // Eight days ahead, then the seven days before for the catch-up.
    expect(vi.mocked(deps.getReadings).mock.calls.slice(0, 8).map(([d]: [string]) => d).at(-1)).toBe('2026-10-28');
    expect(vi.mocked(deps.getReadings).mock.calls[8][0]).toBe('2026-10-20');
  });

  it('catches up the past week\'s missing reflections with time left over', async () => {
    const deps = setup({}, [...DATES, '2026-10-19', '2026-10-20'], [...DATES, '2026-10-20']);
    await runReadingsJob(deps);
    expect(deps.writeReflection).toHaveBeenCalledTimes(1);
    expect(deps.saveReflection).toHaveBeenCalledWith('2026-10-19', 'reflection');
    expect(deps.logRun).toHaveBeenCalledWith('readings', 'ok', expect.stringContaining('caught up AI for 2026-10-19'));
  });

  it('skips the catch-up once the budget is spent', async () => {
    let t = 0;
    const deps = setup({ clock: () => (t += 1000), budgetMs: 9_000 }, [...DATES, '2026-10-19'], DATES);
    await runReadingsJob(deps);
    expect(deps.saveReflection).not.toHaveBeenCalledWith('2026-10-19', expect.anything());
  });

  it('writes prep questions once, for the Sunday only', async () => {
    const asked = new Set<string>();
    const questions = {
      has: vi.fn(async (d: string) => asked.has(d)),
      write: vi.fn(async () => ['Q1?', 'Q2?']),
      save: vi.fn(async (d: string) => void asked.add(d)),
    };
    const deps = setup({ questions });
    await runReadingsJob(deps);
    await runReadingsJob(deps);
    expect(questions.save).toHaveBeenCalledTimes(1);
    expect(questions.save).toHaveBeenCalledWith('2026-10-25', ['Q1?', 'Q2?']);
  });

  it('keeps readings and does not alert when the questions fail', async () => {
    const questions = {
      has: vi.fn(async () => false),
      write: vi.fn(async () => { throw new Error('gemini down'); }),
      save: vi.fn(async () => {}),
    };
    const deps = setup({ questions });
    const res = await runReadingsJob(deps);
    expect(res.failed).toEqual([]);
    expect(deps.saveReflection).toHaveBeenCalledTimes(8);
    expect(questions.save).not.toHaveBeenCalled();
    expect(deps.alert).not.toHaveBeenCalled();
  });

  it('writes insights once per date, after its reflection', async () => {
    const written = new Set<string>();
    const insights = {
      has: vi.fn(async (d: string) => written.has(d)),
      write: vi.fn(async () => ({ theology: 'T', catechism: [{ paragraph: 1324, connection: 'C' }], prayer: 'P' })),
      save: vi.fn(async (d: string) => void written.add(d)),
    };
    const reflected = new Set<string>();
    const deps = setup({
      insights,
      hasReflection: vi.fn(async (d: string) => reflected.has(d)),
      saveReflection: vi.fn(async (d: string) => void reflected.add(d)),
    });
    await runReadingsJob(deps);
    await runReadingsJob(deps);
    expect(insights.save).toHaveBeenCalledTimes(8);
    expect(insights.save).toHaveBeenCalledWith('2026-10-21', expect.objectContaining({ theology: 'T' }));
  });

  it('skips insights when the reflection could not be written, and still writes questions when insights fail', async () => {
    const insights = {
      has: vi.fn(async () => false),
      write: vi.fn(async () => { throw new Error('gemini down'); }),
      save: vi.fn(async () => {}),
    };
    const questions = { has: vi.fn(async () => false), write: vi.fn(async () => ['Q?']), save: vi.fn(async () => {}) };
    const deps = setup({ insights, questions, hasReflection: vi.fn(async () => true) });
    const res = await runReadingsJob(deps);
    expect(res.failed).toEqual([]);
    expect(questions.save).toHaveBeenCalledWith('2026-10-25', ['Q?']);
    expect(deps.alert).not.toHaveBeenCalled();

    const noReflection = setup({ insights, hasReflection: vi.fn(async () => false), writeReflection: vi.fn(async () => { throw new Error('down'); }) });
    insights.write.mockClear();
    await runReadingsJob(noReflection);
    expect(insights.write).not.toHaveBeenCalled();
  });

  it('writes a study guide per date at the wanted level, and rewrites the coming week when the level changes', async () => {
    const stored = new Map<string, StudyLevel>();
    let level: StudyLevel = 'brief';
    const study = {
      level: vi.fn(() => level),
      stored: vi.fn(async (d: string) => stored.get(d) ?? null),
      write: vi.fn(async (_r: DailyReadings, l: StudyLevel) => ({ level: l, readings: [] })),
      save: vi.fn(async (d: string, g: { level: StudyLevel }) => void stored.set(d, g.level)),
    };
    // Last week already has brief guides; they are not rewritten when the level changes.
    stored.set('2026-10-20', 'brief');
    const deps = setup({ study, hasReflection: vi.fn(async () => true) }, ['2026-10-20']);
    await runReadingsJob(deps);
    expect(study.save).toHaveBeenCalledTimes(8);
    await runReadingsJob(deps);
    expect(study.save).toHaveBeenCalledTimes(8);

    level = 'full';
    study.save.mockClear();
    await runReadingsJob(deps);
    expect(study.save).toHaveBeenCalledTimes(8);
    expect(study.save).not.toHaveBeenCalledWith('2026-10-20', expect.anything());
    expect(stored.get('2026-10-21')).toBe('full');
  });

  it('records a study guide failure without failing the readings', async () => {
    const study = {
      level: () => 'brief' as const,
      stored: vi.fn(async () => null),
      write: vi.fn(async () => { throw new Error('timeout'); }),
      save: vi.fn(async () => {}),
    };
    const deps = setup({ study, hasReflection: vi.fn(async () => true) });
    const res = await runReadingsJob(deps);
    expect(res.failed).toEqual([]);
    expect(deps.logRun).toHaveBeenCalledWith('readings', 'ok', expect.stringContaining('study 2026-10-21: timeout'));
  });

  it('writes the personal reflection for today and the coming Sunday only, when missing', async () => {
    const written = new Set<string>(['2026-10-25']);
    const personal = {
      has: vi.fn(async (d: string) => written.has(d)),
      write: vi.fn(async (r: DailyReadings) => void written.add(r.date)),
    };
    const deps = setup({ personal }, ['2026-10-20']);
    await runReadingsJob(deps);
    expect(personal.write).toHaveBeenCalledTimes(1);
    expect(personal.write).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-10-21' }));
    expect(personal.has).not.toHaveBeenCalledWith('2026-10-20');
  });

  it('starts no AI step once the time budget is spent, but still saves the readings', async () => {
    let t = 0;
    const deps = setup({
      clock: () => t,
      budgetMs: 100,
      fetchUsccb: vi.fn(async (d: string) => {
        t += 101; // the fetch itself uses up the budget
        return mk(d);
      }),
    });
    const res = await runReadingsJob(deps);
    expect(res.saved).toEqual(['2026-10-21']);
    expect(deps.writeReflection).not.toHaveBeenCalled();
  });
});
