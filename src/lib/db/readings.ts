import 'server-only';
import type { DailyReadings, ReadingSection } from '@/lib/types';
import { liturgicalDay } from '@/lib/liturgical/calendar';
import { createAdminClient } from './admin';
import { createServerClient } from './server';

/** The day's readings, or null when none are stored (or the lookup fails, so pages still render). */
export async function getReadings(date: string): Promise<DailyReadings | null> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('readings')
      .select('date, feast, lectionary, sections, source_url, fetched_at')
      .eq('date', date)
      .maybeSingle();
    if (error) {
      console.error('getReadings failed', error.message);
      return null;
    }
    if (!data) return null;
    return {
      date: data.date,
      feast: data.feast ?? '',
      lectionary: data.lectionary ?? null,
      sections: (data.sections ?? []) as ReadingSection[],
      sourceUrl: data.source_url ?? '',
      fetchedAt: data.fetched_at,
    };
  } catch (e) {
    console.error('getReadings failed', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Upserts the day's readings (service role). Stores the Sunday cycle on Sundays, the weekday cycle otherwise. */
export async function saveReadings(r: DailyReadings): Promise<void> {
  const day = liturgicalDay(r.date);
  const { error } = await createAdminClient()
    .from('readings')
    .upsert(
      {
        date: r.date,
        feast: r.feast,
        season: day.season,
        color: day.color,
        cycle: day.isSunday ? day.sundayCycle : day.weekdayCycle,
        sections: r.sections,
        lectionary: r.lectionary,
        source_url: r.sourceUrl,
        fetched_at: r.fetchedAt,
      },
      { onConflict: 'date' },
    );
  if (error) throw new Error(`saveReadings ${r.date}: ${error.message}`);
}

export async function getReflection(date: string): Promise<string | null> {
  try {
    const { data, error } = await createServerClient().then((s) =>
      s.from('reflections').select('text').eq('date', date).maybeSingle(),
    );
    if (error) {
      console.error('getReflection failed', error.message);
      return null;
    }
    return data?.text ?? null;
  } catch (e) {
    console.error('getReflection failed', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function hasReflection(date: string): Promise<boolean> {
  const { data, error } = await createAdminClient().from('reflections').select('date').eq('date', date).maybeSingle();
  if (error) throw new Error(`hasReflection ${date}: ${error.message}`);
  return data !== null;
}

/** Stores AI text only in `reflections`; never touches readings fields. */
export async function saveReflection(date: string, text: string, model?: string): Promise<void> {
  const { error } = await createAdminClient()
    .from('reflections')
    .upsert({ date, text, model: model ?? process.env.GEMINI_MODEL ?? 'gemini-2.5-flash' }, { onConflict: 'date' });
  if (error) throw new Error(`saveReflection ${date}: ${error.message}`);
}
