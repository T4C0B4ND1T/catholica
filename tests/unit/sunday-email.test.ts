import { describe, expect, it, vi } from 'vitest';
import { buildSundayEmail, runSundayEmailJob, type SundayEmailDeps } from '@/lib/jobs/sunday-email';
import type { DailyReadings } from '@/lib/types';

// Saturday 2026-10-24, 08:00 Chicago (CDT) = 13:00 UTC
const SAT = new Date('2026-10-24T13:00:00Z');
const SUNDAY = '2026-10-25';

const readings: DailyReadings = {
  date: SUNDAY,
  feast: 'Thirtieth Sunday in Ordinary Time',
  lectionary: '148',
  sections: [
    { kind: 'reading1', title: 'Reading 1', citation: 'Ex 22:20-26', text: 'Thus says the Lord' },
    { kind: 'psalm', title: 'Responsorial Psalm', citation: 'Ps 18', text: 'I love you, Lord' },
    { kind: 'gospel', title: 'Gospel', citation: 'Mt 22:34-40', text: 'You shall love the Lord <your> God\nwith all your heart.' },
  ],
  sourceUrl: 'https://bible.usccb.org/bible/readings/102526.cfm',
  fetchedAt: SAT.toISOString(),
};

describe('buildSundayEmail', () => {
  it('has the feast, citations, Gospel, reflection, questions, bulletin times and a link', () => {
    const e = buildSundayEmail({
      sunday: SUNDAY,
      readings,
      reflection: 'Love is the whole law.',
      questions: ['Whom do I find hard to love?'],
      bulletin: { sundayDate: SUNDAY, summary: { massTimes: ['Sun 9:00 AM'], confession: ['Sat 3:00 PM'], announcements: [{ title: 'Food drive', text: 'Cans in the narthex' }] } },
      siteUrl: 'https://catholica-daily.vercel.app/',
    });
    expect(e.subject).toBe('Sunday prep: Thirtieth Sunday in Ordinary Time');
    for (const s of ['Ex 22:20-26', 'Mt 22:34-40', 'Love is the whole law.', 'Whom do I find hard to love?', 'Mass: Sun 9:00 AM', 'Confession: Sat 3:00 PM']) {
      expect(e.text).toContain(s);
    }
    expect(e.text).toContain('https://catholica-daily.vercel.app/sunday?date=2026-10-25');
    expect(e.text).toContain('- Food drive: Cans in the narthex');
    expect(e.html).toContain('From the bulletin');
    expect(e.html).toContain('&lt;your&gt;');
    // Every reading in full, and the at-a-glance box.
    expect(e.html).toContain('Thus says the Lord');
    expect(e.html).toContain('At a glance');
    expect(e.html).toContain('Ordinary Time · Year A');
    expect(e.html).not.toContain('<your>');
  });

  it('puts study notes under each reading and adds the deeper notes and the personal reflection', () => {
    const e = buildSundayEmail({
      sunday: SUNDAY,
      readings,
      reflection: 'Homily text',
      questions: null,
      insights: { theology: 'One law of love', catechism: [{ paragraph: 2055, connection: 'The two commandments' }], prayer: 'Pray it' },
      study: {
        level: 'full',
        readings: [{ index: 2, context: { who: 'Matthew', when: 'c. AD 80', where: 'Syria', why: 'A test' }, explanation: 'Jesus joins two commands.', reflection: 'Love today.' }],
      },
      personal: 'For Joel only',
      bulletin: null,
      siteUrl: 'https://x.test',
    });
    for (const t of ['Who: Matthew', 'Explanation: Jesus joins two commands.', 'SHORT HOMILY', 'CCC 2055: The two commandments', 'FOR YOU', 'For Joel only']) {
      expect(e.text).toContain(t);
    }
    // The notes follow the Gospel, not the first reading.
    expect(e.text.indexOf('Who: Matthew')).toBeGreaterThan(e.text.indexOf('with all your heart.'));
    expect(e.html).toContain('Study notes · written by AI');
    expect(e.html).toContain('Going deeper');
  });

  it('still builds when nothing is saved yet', () => {
    const e = buildSundayEmail({ sunday: SUNDAY, readings: null, reflection: null, questions: null, bulletin: null, siteUrl: 'https://x.test' });
    expect(e.subject).toBe('Sunday prep: This Sunday');
    expect(e.text).toContain("aren't saved yet");
  });
});

function deps(over: Partial<SundayEmailDeps> = {}): SundayEmailDeps {
  return {
    getReadings: vi.fn(async () => readings),
    getReflection: vi.fn(async () => 'r'),
    getQuestions: vi.fn(async () => ['q']),
    latestBulletin: vi.fn(async () => ({ sundayDate: '2026-10-18' })),
    getBulletinSummary: vi.fn(async () => null),
    send: vi.fn(async () => true),
    logRun: vi.fn(async () => {}),
    siteUrl: 'https://x.test',
    now: SAT,
    ...over,
  };
}

describe('runSundayEmailJob', () => {
  it('sends for the next day and logs it', async () => {
    const d = deps();
    const res = await runSundayEmailJob(d);
    expect(res).toMatchObject({ status: 'sent', sunday: SUNDAY });
    expect(d.getReadings).toHaveBeenCalledWith(SUNDAY);
    expect(d.getBulletinSummary).toHaveBeenCalledWith('2026-10-18');
    expect(d.logRun).toHaveBeenCalledWith('sunday-email', 'ok', 'sent for 2026-10-25');
  });

  it('leaves out a bulletin older than the week before', async () => {
    const d = deps({ latestBulletin: vi.fn(async () => ({ sundayDate: '2026-10-11' })) });
    await runSundayEmailJob(d);
    expect(d.getBulletinSummary).not.toHaveBeenCalled();
  });

  it('reports when email is not set up', async () => {
    const d = deps({ send: vi.fn(async () => false), getQuestions: vi.fn(async () => null) });
    const res = await runSundayEmailJob(d);
    expect(res.status).toBe('not-configured');
    expect(d.logRun).toHaveBeenCalledWith('sunday-email', 'error', 'not sent (email not set up) for 2026-10-25; missing questions');
  });

  it('logs a send failure', async () => {
    const d = deps({ send: vi.fn(async () => { throw new Error('Resend failed: nope'); }) });
    const res = await runSundayEmailJob(d);
    expect(res.status).toBe('error');
    expect(d.logRun).toHaveBeenCalledWith('sunday-email', 'error', 'failed for 2026-10-25: Resend failed: nope');
  });
});
