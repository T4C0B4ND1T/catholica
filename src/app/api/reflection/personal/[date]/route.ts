import { writePersonal } from '@/lib/ai/writer';
import { requireUser } from '@/lib/auth/require-user';
import { dateParam } from '@/lib/dates';
import { personalContext, readPersonal, savePersonal } from '@/lib/db/personal';
import { readReadings, readReflection } from '@/lib/db/readings';
import { createServerClient } from '@/lib/db/server';
import { studyDepthOf, studyLevel } from '@/lib/study';

export const maxDuration = 120;

type Ctx = { params: Promise<{ date: string }> };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

async function handle(ctx: Ctx, run: (date: string, user: Awaited<ReturnType<typeof requireUser>>) => Promise<Response>) {
  try {
    const user = await requireUser();
    const date = dateParam((await ctx.params).date);
    if (!date) return json({ error: 'invalid date' }, 400);
    return await run(date, user);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('personal reflection failed', e instanceof Error ? e.message : e);
    return json({ error: 'server error' }, 500);
  }
}

/** The reader's stored personal reflection for the day, or null. */
export function GET(_req: Request, ctx: Ctx) {
  return handle(ctx, async (date, user) => json({ personal: await readPersonal(await createServerClient(), user.id, date) }));
}

/** Writes (or rewrites) the reader's personal reflection for the day from their notes and intentions. */
export function POST(_req: Request, ctx: Ctx) {
  return handle(ctx, async (date, user) => {
    const readings = await readReadings(date);
    if (!readings) return json({ error: 'no readings' }, 404);
    const db = await createServerClient();
    const level = studyLevel(date, studyDepthOf(user.metadata));
    const [context, homily] = await Promise.all([personalContext(db, user.id, date), readReflection(date)]);
    try {
      const text = await writePersonal({ readings, level, homily, ...context });
      await savePersonal(db, user.id, date, text, level);
    } catch (e) {
      console.error('writePersonal failed', e instanceof Error ? e.message : e);
      return json({ error: 'ai failed' }, 502);
    }
    return json({ personal: await readPersonal(db, user.id, date) });
  });
}
