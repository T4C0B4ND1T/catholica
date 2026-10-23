import { addDays, formatDay, todayInChicago } from '@/lib/dates';
import { comingSunday, liturgicalDay } from '@/lib/liturgical/calendar';
import { defaultMass, massSections } from '@/lib/mass-options';
import type { BulletinSummary, DailyReadings, Season } from '@/lib/types';

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

// Email clients ignore most CSS: a table layout with inline styles and web-safe fallbacks for the app's fonts.
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";
const BODY_SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Source Sans 3', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const INK = '#1A1A1A';
const MUTED = '#6B6B6B';
const GOLD = '#B8860B';
const GOLD_INK = '#8A6508';
const RULE = '#E8E4DA';

const SEASON_NAMES: Record<Season, string> = {
  advent: 'Advent',
  christmas: 'Christmas Time',
  ordinary: 'Ordinary Time',
  lent: 'Lent',
  triduum: 'Sacred Paschal Triduum',
  easter: 'Easter Time',
};

const smallCaps = (t: string, color = MUTED) =>
  `<p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.5;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${color}">${esc(t)}</p>`;
const aiNote = (t: string) => `<p style="margin:4px 0 14px;font-family:${SANS};font-size:13px;line-height:1.5;font-style:italic;color:${MUTED}">${esc(t)}</p>`;
const paras = (s: string, font = BODY_SERIF, size = 17) =>
  s
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px;font-family:${font};font-size:${size}px;line-height:1.65;color:${INK}">${esc(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');

/** One titled section of the card: a gold small-caps label over a rule, then its content. */
function section(title: string, content: string): string {
  return `<tr><td style="padding:28px 32px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="border-bottom:1px solid ${RULE};padding-bottom:8px">${smallCaps(title, GOLD_INK)}</td></tr></table>
<div style="height:14px;line-height:14px">&nbsp;</div>${content}</td></tr>`;
}

/** Label/value rows for the at-a-glance box. */
function glanceRows(rows: [string, string][]): string {
  return rows
    .map(
      ([k, v]) =>
        `<tr><td valign="top" style="padding:4px 12px 4px 0;font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:${MUTED};white-space:nowrap">${esc(k)}</td><td valign="top" style="padding:4px 0;font-family:${SANS};font-size:15px;line-height:1.5;color:${INK}">${v}</td></tr>`,
    )
    .join('');
}

const list = (items: string[]) => items.map((t) => esc(t)).join('<br>');

/** The Saturday email: the coming Sunday at a glance, every reading in full, the reflection and questions, and the bulletin. */
export function buildSundayEmail(c: SundayEmailContent): Email {
  const day = formatDay(c.sunday);
  const title = c.readings?.feast || 'This Sunday';
  const lit = liturgicalDay(c.sunday);
  const link = `${c.siteUrl.replace(/\/$/, '')}/sunday?date=${c.sunday}`;
  const sections = c.readings ? massSections(c.readings.sections, defaultMass(c.readings.sections)) : [];
  const gospel = sections.find((s) => s.section.kind === 'gospel')?.section;
  const summary = c.bulletin?.summary;
  const bulletinDay = c.bulletin ? formatDay(c.bulletin.sundayDate) : '';

  // Plain-text part, for clients that don't show HTML.
  const text: string[] = [title, `${day} · ${SEASON_NAMES[lit.season]} · Year ${lit.sundayCycle}`, ''];
  if (sections.length) {
    for (const s of sections) text.push(`${s.label.toUpperCase()} · ${s.section.citation}`, s.section.text, '');
  } else text.push("The readings for this Sunday aren't saved yet.", '');
  if (c.reflection) text.push('REFLECTION (written by AI, not Scripture or Church teaching)', c.reflection, '');
  if (c.questions?.length) text.push('QUESTIONS TO PRAY WITH', ...c.questions.map((q, i) => `${i + 1}. ${q}`), '');
  if (summary) {
    text.push(`BULLETIN · ${bulletinDay} (summarized by AI)`);
    text.push(...summary.massTimes.map((t) => `Mass: ${t}`), ...summary.confession.map((t) => `Confession: ${t}`));
    for (const a of summary.announcements) text.push(`- ${[a.title, a.text].filter(Boolean).join(': ')}`);
    text.push('');
  }
  text.push(`Open Sunday prep: ${link}`);
  if (c.readings?.sourceUrl) text.push(`Readings: NABRE, from USCCB (${c.readings.sourceUrl})`);

  const rows: string[] = [];

  // Header
  rows.push(`<tr><td style="padding:36px 32px 8px;text-align:center">
${smallCaps(`Sunday prep · ${day}`)}
<h1 style="margin:12px 0 0;font-family:${SERIF};font-size:30px;line-height:1.2;font-weight:400;color:${INK}">${esc(title)}</h1>
<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:16px auto"><tr><td width="64" height="1" style="background:${GOLD};font-size:0;line-height:0">&nbsp;</td></tr></table>
${smallCaps(`${SEASON_NAMES[lit.season]} · Year ${lit.sundayCycle}`)}
</td></tr>`);

  // At a glance
  const glance: [string, string][] = [];
  if (gospel?.citation) glance.push(['Gospel', esc(gospel.citation)]);
  if (summary?.massTimes.length) glance.push(['Mass', list(summary.massTimes)]);
  if (summary?.confession.length) glance.push(['Confession', list(summary.confession)]);
  if (glance.length) {
    rows.push(`<tr><td style="padding:20px 32px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FBF7EC;border:1px solid #EADFC2;border-radius:8px"><tr><td style="padding:16px 20px">
${smallCaps('At a glance', GOLD_INK)}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px">${glanceRows(glance)}</table>
</td></tr></table></td></tr>`);
  }

  // Readings, in full
  rows.push(
    section(
      'The readings',
      sections.length
        ? sections
            .map(
              (s, i) => `<p style="margin:${i ? '22px' : '0'} 0 2px;font-family:${SERIF};font-size:20px;line-height:1.3;color:${INK}">${esc(s.label)}</p>
<p style="margin:0 0 10px;font-family:${SANS};font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:${MUTED}">${esc(s.section.citation)}</p>
${paras(s.section.text)}`,
            )
            .join('')
        : paras("The readings for this Sunday aren't saved yet. They arrive about a week ahead.", SANS, 16),
    ),
  );

  if (c.reflection) {
    rows.push(section('Reflection', aiNote('Written by AI. Not Scripture and not Church teaching.') + paras(c.reflection, SANS, 16)));
  }

  if (c.questions?.length) {
    rows.push(
      section(
        'Questions to pray with',
        `<ol style="margin:0;padding-left:22px">${c.questions
          .map((q) => `<li style="margin:0 0 10px;font-family:${SANS};font-size:16px;line-height:1.6;color:${INK}">${esc(q)}</li>`)
          .join('')}</ol>`,
      ),
    );
  }

  if (summary && summary.announcements.length) {
    rows.push(
      section(
        `From the bulletin · ${bulletinDay}`,
        aiNote('Summarized by AI. Check the bulletin before you rely on a time.') +
          summary.announcements
            .map(
              (a) =>
                `<p style="margin:0 0 12px;font-family:${SANS};font-size:15px;line-height:1.55;color:${INK}">${a.title ? `<strong>${esc(a.title)}</strong><br>` : ''}${a.text ? `<span style="color:${MUTED}">${esc(a.text)}</span>` : ''}</p>`,
            )
            .join(''),
      ),
    );
  }

  // Button and footer
  rows.push(`<tr><td style="padding:28px 32px 36px;text-align:center">
<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${GOLD};border-radius:6px">
<a href="${esc(link)}" style="display:inline-block;padding:13px 26px;font-family:${SANS};font-size:15px;font-weight:600;letter-spacing:.04em;color:${INK};text-decoration:none">Open Sunday prep</a>
</td></tr></table>
${c.readings?.sourceUrl ? `<p style="margin:20px 0 0;font-family:${SANS};font-size:12px;color:${MUTED}">Readings: NABRE · <a href="${esc(c.readings.sourceUrl)}" style="color:${MUTED}">Source: USCCB</a></p>` : ''}
</td></tr>`);

  const preheader = [gospel?.citation && `Gospel ${gospel.citation}`, summary?.massTimes[0] && `Mass ${summary.massTimes[0]}`].filter(Boolean).join(' · ');

  return {
    subject: `Sunday prep: ${title}`,
    text: text.join('\n'),
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(`Sunday prep: ${title}`)}</title></head>
<body style="margin:0;padding:0;background:#F3F1EC">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F1EC"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFFFF;border:1px solid ${RULE};border-radius:10px">
${rows.join('\n')}
</table>
<p style="margin:16px 0 0;font-family:${SANS};font-size:12px;color:${MUTED}">Catholica · sent every Saturday morning</p>
</td></tr></table>
</body></html>`,
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
