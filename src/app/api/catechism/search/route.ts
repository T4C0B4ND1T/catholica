import { searchCatechism } from '@/lib/sources/catechism';

const MIN_QUERY = 2;
const MAX_QUERY = 100;

/** Keyword search of the Catechism: first page of verbatim paragraphs from the source. */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
  if (q.length < MIN_QUERY || q.length > MAX_QUERY) return Response.json({ error: 'invalid query' }, { status: 400 });
  try {
    const result = await searchCatechism(q);
    return Response.json(result, { headers: { 'cache-control': 'public, s-maxage=86400' } });
  } catch (e) {
    console.error('catechism search failed', e instanceof Error ? e.message : e);
    return Response.json({ error: 'source unavailable' }, { status: 502 });
  }
}
