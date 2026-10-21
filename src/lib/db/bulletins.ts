import 'server-only';
import type { Bulletin } from '@/lib/types';
import { createAdminClient } from './admin';
import { createServerClient } from './server';

const BUCKET = 'bulletins';

interface BulletinRow {
  sunday_date: string;
  source_url: string | null;
  storage_path: string | null;
  page_count: number | null;
  fetched_at: string;
}

const COLUMNS = 'sunday_date, source_url, storage_path, page_count, fetched_at';

function toBulletin(r: BulletinRow): Bulletin {
  return {
    sundayDate: r.sunday_date,
    sourceUrl: r.source_url ?? '',
    storagePath: r.storage_path ?? '',
    pageCount: r.page_count ?? 0,
    fetchedAt: r.fetched_at,
  };
}

/** All saved bulletins, newest first. Throws when the lookup fails. */
export async function listBulletins(): Promise<Bulletin[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from('bulletins').select(COLUMNS).order('sunday_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toBulletin);
}

/** The newest saved bulletin, or null when none exist. Throws when the lookup fails. */
export async function latestBulletin(): Promise<Bulletin | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('bulletins')
    .select(COLUMNS)
    .order('sunday_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toBulletin(data) : null;
}

/** One bulletin by Sunday date, or null. Throws when the lookup fails. */
export async function getBulletin(date: string): Promise<Bulletin | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from('bulletins').select(COLUMNS).eq('sunday_date', date).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toBulletin(data) : null;
}

/**
 * Full-text search (SQL function `search_bulletins`): at most 20 rows, newest first. Snippets are ts_headline
 * output derived from parish PDF text, with `<mark>` around matches; treat everything else as untrusted text.
 */
export async function searchBulletins(q: string): Promise<{ sundayDate: string; snippet: string }[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('search_bulletins', { q });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { sunday_date: string; snippet: string }[]).map((r) => ({
    sundayDate: r.sunday_date,
    snippet: r.snippet,
  }));
}

/** The bulletin PDF bytes (private bucket, service role), or null when the date or file is unknown. */
export async function getBulletinPdf(date: string): Promise<Uint8Array | null> {
  const admin = createAdminClient();
  const { data: row, error } = await admin.from('bulletins').select('storage_path').eq('sunday_date', date).maybeSingle();
  if (error) throw new Error(`getBulletinPdf ${date}: ${error.message}`);
  if (!row?.storage_path) return null;
  const { data: blob, error: dlError } = await admin.storage.from(BUCKET).download(row.storage_path);
  if (dlError || !blob) {
    // A missing object is "unknown"; anything else is a real failure.
    if (/not.?found|does not exist|404/i.test(dlError?.message ?? '')) return null;
    throw new Error(`getBulletinPdf ${date}: ${dlError?.message ?? 'no data'}`);
  }
  return new Uint8Array(await blob.arrayBuffer());
}
