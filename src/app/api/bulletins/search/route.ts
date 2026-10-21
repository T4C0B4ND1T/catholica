import { searchBulletins } from '@/lib/db/bulletins';

export async function GET(req: Request): Promise<Response> {
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 100);
  if (q.length < 2) return Response.json({ results: [] }, { headers: { 'Cache-Control': 'public, s-maxage=60' } });
  try {
    const results = await searchBulletins(q);
    return Response.json({ results }, { headers: { 'Cache-Control': 'public, s-maxage=60' } });
  } catch (e) {
    console.error('bulletin search failed', e instanceof Error ? e.message : e);
    return Response.json({ error: 'Search failed' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
