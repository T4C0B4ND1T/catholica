import 'server-only';
import type { DailyReadings, ReadingSection } from '@/lib/types';
import { geminiModel } from '@/lib/ai/model';
import { liturgicalDay } from '@/lib/liturgical/calendar';
import { createAdminClient } from './admin';
import { createServerClient } from './server';

/** The day's readings, or null when none are stored. Throws when the lookup fails. */
export async function readReadings(date: string): Promise<DailyReadings | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('readings')
    .select('date, feast, lectionary, sections, source_url, fetched_at')
    .eq('date', date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    date: data.date,
    feast: data.feast ?? '',
    lectionary: data.lectionary ?? null,
    sections: (data.sections ?? []) as ReadingSection[],
    sourceUrl: data.source_url ?? '',
    fetchedAt: data.fetched_at,
  };
}

/** The day's readings, or null when none are stored (or the lookup fails, so pages still render). */
export async function getReadings(date: string): Promise<DailyReadings | null> {
  try {
    return await readReadings(date);
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

/** The day's AI reflection, or null when none is stored. Throws when the lookup fails. */
export async function readReflection(date: string): Promise<string | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from('reflections').select('text').eq('date', date).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.text ?? null;
}

export async function getReflection(date: string): Promise<string | null> {
  try {
    return await readReflection(date);
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
    .upsert({ date, text, model: model ?? geminiModel() }, { onConflict: 'date' });
  if (error) throw new Error(`saveReflection ${date}: ${error.message}`);
}
