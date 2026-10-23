import { addDays, formatDay, todayInChicago } from '@/lib/dates';
import { comingSunday } from '@/lib/liturgical/calendar';
import { defaultMass, massSections } from '@/lib/mass-options';
import type { BulletinSummary, DailyReadings } from '@/lib/types';

export interface SundayEmailContent {
  sunday: string;
  readings: DailyReadings | null;
  reflection: string | null;
  questions: string[] | null;
  /** The newest bulletin, when it is this Sunday's or the one before. */
  bulletin: { sundayDate: string; summary: BulletinSummary | null } | null;
  siteUrl: string;
}

export interface Email {
  subject: string;
  text: string;
  html: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const paras = (s: string) =>
  s
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${esc(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');

const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";
const SANS = "'Source Sans 3', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const label = (t: string) =>
  `<p style="margin:28px 0 8px;font:600 12px/1.4 ${SANS};letter-spacing:.12em;text-transform:uppercase;color:#6B6B6B">${esc(t)}</p>`;

/** The Saturday email: the coming Sunday's readings, the Gospel, the reflection and questions, and the bulletin times. */
export function buildSundayEmail(c: SundayEmailContent): Email {
  const day = formatDay(c.sunday);
  const title = c.readings?.feast || 'This Sunday';
  const link = `${c.siteUrl.replace(/\/$/, '')}/sunday?date=${c.sunday}`;
  const sections = c.readings ? massSections(c.readings.sections, defaultMass(c.readings.sections)) : [];
  const gospel = sections.find((s) => s.section.kind === 'gospel')?.section;
  const summary = c.bulletin?.summary;

  const text: string[] = [`${title}`, day, ''];
  const html: string[] = [
    `<p style="margin:0;font:600 12px/1.4 ${SANS};letter-spacing:.12em;text-transform:uppercase;color:#6B6B6B">Sunday prep · ${esc(day)}</p>`,
    `<h1 style="margin:8px 0 0;font:400 28px/1.2 ${SERIF};color:#1A1A1A">${esc(title)}</h1>`,
    '<div style="width:64px;height:1px;background:#B8860B;margin:16px 0"></div>',
  ];

  if (sections.length) {
    text.push('READINGS', ...sections.map((s) => `${s.label}: ${s.section.citation}`), '');
    html.push(
      label('Readings'),
      `<ul style="margin:0;padding-left:18px">${sections.map((s) => `<li>${esc(s.label)} · ${esc(s.section.citation)}</li>`).join('')}</ul>`,
    );
  } else {
    text.push("The readings for this Sunday aren't saved yet.", '');
    html.push(`<p>The readings for this Sunday aren't saved yet.</p>`);
  }

  if (gospel) {
    text.push(`GOSPEL · ${gospel.citation}`, gospel.text, '');
    html.push(label(`Gospel · ${gospel.citation}`), paras(gospel.text));
  }

  if (c.reflection) {
    text.push('REFLECTION (written by AI, not Scripture or Church teaching)', c.reflection, '');
    html.push(
      label('Reflection'),
      `<p style="margin:0 0 8px;font-style:italic;color:#6B6B6B;font-size:14px">Written by AI. Not Scripture and not Church teaching.</p>`,
      paras(c.reflection),
    );
  }

  if (c.questions?.length) {
    text.push('QUESTIONS TO PRAY WITH', ...c.questions.map((q, i) => `${i + 1}. ${q}`), '');
    html.push(label('Questions to pray with'), `<ol style="margin:0;padding-left:20px">${c.questions.map((q) => `<li style="margin-bottom:6px">${esc(q)}</li>`).join('')}</ol>`);
  }

  if (summary && (summary.massTimes.length || summary.confession.length)) {
    const lines = [
      ...summary.massTimes.map((t) => `Mass: ${t}`),
      ...summary.confession.map((t) => `Confession: ${t}`),
    ];
    text.push(`BULLETIN (${formatDay(c.bulletin!.sundayDate)}, summarized by AI)`, ...lines, '');
    html.push(
      label(`Bulletin · ${formatDay(c.bulletin!.sundayDate)}`),
      `<p style="margin:0 0 8px;font-style:italic;color:#6B6B6B;font-size:14px">Summarized by AI. Check the bulletin before you rely on a time.</p>`,
      `<ul style="margin:0;padding-left:18px">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`,
    );
  }

  text.push(`Open Sunday prep: ${link}`);
  html.push(
    `<p style="margin:32px 0 0"><a href="${esc(link)}" style="display:inline-block;padding:12px 20px;background:#B8860B;color:#1A1A1A;text-decoration:none;border-radius:6px;font:500 15px/1 ${SANS}">Open Sunday prep</a></p>`,
  );
  if (c.readings?.sourceUrl) {
    text.push(`Readings: NABRE, from USCCB (${c.readings.sourceUrl})`);
    html.push(`<p style="margin:24px 0 0;font-size:12px;color:#6B6B6B">Readings: NABRE · <a href="${esc(c.readings.sourceUrl)}" style="color:#6B6B6B">Source: USCCB</a></p>`);
  }

  return {
    subject: `Sunday prep: ${title}`,
    text: text.join('\n'),
    html: `<!doctype html><html><body style="margin:0;background:#FAFAF8"><div style="max-width:560px;margin:0 auto;padding:32px 20px;font:16px/1.6 ${SANS};color:#1A1A1A">${html.join('')}</div></body></html>`,
  };
}

export interface SundayEmailDeps {
  getReadings: (date: string) => Promise<DailyReadings | null>;
  getReflection: (date: string) => Promise<string | null>;
  getQuestions: (date: string) => Promise<string[] | null>;
  latestBulletin: () => Promise<{ sundayDate: string } | null>;
  getBulletinSummary: (date: string) => Promise<BulletinSummary | null>;
  /** Sends the email; false when email isn't set up (no Resend key or address). */
  send: (email: Email) => Promise<boolean>;
  logRun: (job: 'sunday-email', status: 'ok' | 'error', message: string) => Promise<void>;
  siteUrl: string;
  now: Date;
}

/** Builds and sends the email for the coming Sunday. Missing pieces are left out rather than holding the email back. */
export async function runSundayEmailJob(deps: SundayEmailDeps): Promise<{ status: 'sent' | 'not-configured' | 'error'; sunday: string; message?: string }> {
  const sunday = comingSunday(todayInChicago(deps.now));
  try {
    const [readings, reflection, questions, newest] = await Promise.all([
      deps.getReadings(sunday),
      deps.getReflection(sunday),
      deps.getQuestions(sunday),
      deps.latestBulletin().catch(() => null),
    ]);
    const week = newest && newest.sundayDate >= addDays(sunday, -7) ? newest : null;
    const bulletin = week ? { sundayDate: week.sundayDate, summary: await deps.getBulletinSummary(week.sundayDate) } : null;
    const email = buildSundayEmail({ sunday, readings, reflection, questions, bulletin, siteUrl: deps.siteUrl });
    const sent = await deps.send(email);
    const missing = [!readings && 'readings', !reflection && 'reflection', !questions && 'questions'].filter(Boolean);
    const message = `${sent ? 'sent' : 'not sent (email not set up)'} for ${sunday}${missing.length ? `; missing ${missing.join(', ')}` : ''}`;
    await deps.logRun('sunday-email', sent ? 'ok' : 'error', message);
    return { status: sent ? 'sent' : 'not-configured', sunday, message };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await deps.logRun('sunday-email', 'error', `failed for ${sunday}: ${message}`);
    return { status: 'error', sunday, message };
  }
}
