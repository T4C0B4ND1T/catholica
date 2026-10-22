import { fetchCatechism } from '@/lib/sources/catechism';

type Ctx = { params: Promise<{ num: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { num } = await ctx.params;
  if (!/^\d{1,4}$/.test(num)) return Response.json({ error: 'invalid paragraph' }, { status: 400 });
  try {
    const paragraph = await fetchCatechism(Number(num));
    if (!paragraph) return Response.json({ error: 'not found' }, { status: 404 });
    return Response.json(paragraph, { headers: { 'cache-control': 'public, s-maxage=604800' } });
  } catch (e) {
    console.error('catechism lookup failed', e instanceof Error ? e.message : e);
    return Response.json({ error: 'source unavailable' }, { status: 502 });
  }
}
