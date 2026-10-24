import { writeInsights, writePersonal, writeQuestions, writeReflection, writeStudy } from '@/lib/ai/writer';
import { createAdminClient } from '@/lib/db/admin';
import { logRun } from '@/lib/db/jobs';
import { allowedReader, personalContext, readPersonal, savePersonal } from '@/lib/db/personal';
import {
  getReadings,
  hasInsights,
  hasQuestions,
  hasReflection,
  saveInsights,
  saveQuestions,
  saveReadings,
  saveReflection,
  saveStudy,
  studyLevelStored,
} from '@/lib/db/readings';
import { sendAlert } from '@/lib/jobs/alert';
import { assertCron } from '@/lib/jobs/cron-auth';
import { runReadingsJob, type ReadingsJobDeps } from '@/lib/jobs/readings-job';
import { fetchUsccb } from '@/lib/sources/usccb';
import { DEFAULT_STUDY_DEPTH, studyLevel } from '@/lib/study';

export const maxDuration = 300;

/** The personal reflection for the allowed reader, or nothing when they haven't signed in yet. */
function personalDeps(reader: Awaited<ReturnType<typeof allowedReader>>): ReadingsJobDeps['personal'] {
  if (!reader) return undefined;
  const db = createAdminClient();
  return {
    has: async (date) => (await readPersonal(db, reader.id, date)) !== null,
    write: async (r) => {
      const level = studyLevel(r.date, reader.depth);
      const [context, homily] = await Promise.all([
        personalContext(db, reader.id, r.date),
        db.from('reflections').select('text').eq('date', r.date).maybeSingle().then(({ data }) => (data?.text as string | undefined) ?? null),
      ]);
      await savePersonal(db, reader.id, r.date, await writePersonal({ readings: r, level, homily, ...context }), level);
    },
  };
}

export async function GET(req: Request): Promise<Response> {
  const denied = assertCron(req);
  if (denied) return denied;
  const reader = await allowedReader().catch((e) => {
    console.error('allowedReader failed', e instanceof Error ? e.message : e);
    return null;
  });
  const depth = reader?.depth ?? DEFAULT_STUDY_DEPTH;
  const result = await runReadingsJob({
    fetchUsccb,
    getReadings,
    saveReadings,
    saveReflection,
    hasReflection,
    writeReflection,
    insights: { has: hasInsights, write: writeInsights, save: saveInsights },
    study: { level: (date) => studyLevel(date, depth), stored: studyLevelStored, write: writeStudy, save: saveStudy },
    personal: personalDeps(reader),
    questions: { has: hasQuestions, write: writeQuestions, save: saveQuestions },
    logRun,
    alert: sendAlert,
    now: new Date(),
  });
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
