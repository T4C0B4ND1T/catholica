import 'server-only';
import { cache } from 'react';
import type { Bulletin, BulletinSummary } from '@/lib/types';
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

/** The newest saved bulletin, or null when none exist. Throws when the lookup fails. One query per request. */
export const latestBulletin = cache(async function latestBulletin(): Promise<Bulletin | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('bulletins')
    .select(COLUMNS)
    .order('sunday_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toBulletin(data) : null;
});

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

/**
 * A short-lived signed URL for the bulletin PDF (private bucket, service role), or null when the date or file is
 * unknown. Real bulletins are 5 to 10 MB, over Vercel's 4.5 MB function response limit, so the file is never proxied.
 */
export async function getBulletinPdfUrl(date: string, expiresInSeconds: number): Promise<string | null> {
  const admin = createAdminClient();
  const { data: row, error } = await admin.from('bulletins').select('storage_path').eq('sunday_date', date).maybeSingle();
  if (error) throw new Error(`getBulletinPdfUrl ${date}: ${error.message}`);
  if (!row?.storage_path) return null;
  const { data, error: signError } = await admin.storage.from(BUCKET).createSignedUrl(row.storage_path, expiresInSeconds);
  if (signError || !data?.signedUrl) {
    // A missing object is "unknown"; anything else is a real failure.
    if (/not.?found|does not exist|404/i.test(signError?.message ?? '')) return null;
    throw new Error(`getBulletinPdfUrl ${date}: ${signError?.message ?? 'no url'}`);
  }
  return data.signedUrl;
}

/** True when a bulletin row exists for the Sunday. Service role (used by jobs, no request context). Throws on failure. */
export async function hasBulletin(date: string): Promise<boolean> {
  const { data, error } = await createAdminClient().from('bulletins').select('sunday_date').eq('sunday_date', date).maybeSingle();
  if (error) throw new Error(`hasBulletin ${date}: ${error.message}`);
  return data !== null;
}

/** Sunday date of the newest saved bulletin, or null. Service role, no request context. */
export async function newestBulletinDate(): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from('bulletins')
    .select('sunday_date')
    .order('sunday_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`newestBulletinDate: ${error.message}`);
  return data?.sunday_date ?? null;
}

export interface BulletinSaveMeta {
  sundayDate: string;
  sourceUrl: string;
  pageCount: number;
  /** Text extracted from the PDF (verbatim, for search). */
  /** null when extraction failed. */
  text: string | null;
}

/** Stores the PDF in the private bucket at `{date}.pdf` and upserts the row. Throws on failure. */
export async function saveBulletin(meta: BulletinSaveMeta, bytes: Uint8Array): Promise<void> {
  const admin = createAdminClient();
  const storagePath = `${meta.sundayDate}.pdf`;
  const { error: upError } = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (upError) throw new Error(`saveBulletin upload ${meta.sundayDate}: ${upError.message}`);
  const { error } = await admin.from('bulletins').upsert({
    sunday_date: meta.sundayDate,
    source_url: meta.sourceUrl,
    storage_path: storagePath,
    page_count: meta.pageCount,
    text: meta.text,
    fetched_at: new Date().toISOString(),
  });
  if (error) throw new Error(`saveBulletin row ${meta.sundayDate}: ${error.message}`);
}

/** The AI summary for a bulletin, or null when there is none (or the lookup fails, so the page still renders). */
export async function getBulletinSummary(date: string): Promise<BulletinSummary | null> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.from('bulletins').select('summary').eq('sunday_date', date).maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.summary as BulletinSummary | null) ?? null;
  } catch (e) {
    console.error('getBulletinSummary failed', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Newest bulletins that have text but no summary yet. Service role. */
export async function bulletinsMissingSummary(limit: number): Promise<{ sundayDate: string; text: string }[]> {
  const { data, error } = await createAdminClient()
    .from('bulletins')
    .select('sunday_date, text')
    .is('summary', null)
    .not('text', 'is', null)
    .order('sunday_date', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`bulletinsMissingSummary: ${error.message}`);
  return (data ?? []).map((r) => ({ sundayDate: r.sunday_date, text: r.text ?? '' })).filter((r) => r.text.trim() !== '');
}

export async function saveBulletinSummary(date: string, summary: BulletinSummary): Promise<void> {
  const { error } = await createAdminClient().from('bulletins').update({ summary }).eq('sunday_date', date);
  if (error) throw new Error(`saveBulletinSummary ${date}: ${error.message}`);
}

/** Bulletins before `before` whose PDF is still in storage. Service role. */
export async function storedPdfsBefore(before: string): Promise<{ sundayDate: string; storagePath: string }[]> {
  const { data, error } = await createAdminClient()
    .from('bulletins')
    .select('sunday_date, storage_path')
    .lt('sunday_date', before)
    .not('storage_path', 'is', null)
    .order('sunday_date');
  if (error) throw new Error(`storedPdfsBefore: ${error.message}`);
  return (data ?? []).map((r) => ({ sundayDate: r.sunday_date, storagePath: r.storage_path as string }));
}

/**
 * Deletes a bulletin's stored PDF and clears its storage_path. The row keeps its text and summary, so search still
 * finds it, and its source_url still points at the parish's copy.
 */
export async function dropStoredPdf(date: string, storagePath: string): Promise<void> {
  const admin = createAdminClient();
  const { error: rmError } = await admin.storage.from(BUCKET).remove([storagePath]);
  if (rmError) throw new Error(`dropStoredPdf ${date}: ${rmError.message}`);
  const { error } = await admin.from('bulletins').update({ storage_path: null }).eq('sunday_date', date);
  if (error) throw new Error(`dropStoredPdf row ${date}: ${error.message}`);
}
