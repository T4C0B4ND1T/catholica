import { requireUser } from '@/lib/auth/require-user';
import { askCatechism } from '@/lib/ai/writer';
import { fetchCatechism } from '@/lib/sources/catechism';

const MAX_QUESTION = 500;
const MAX_CITED = 8;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

/** Distinct `CCC n` numbers in order of first appearance. */
function citedNumbers(answer: string): number[] {
  const seen: number[] = [];
  for (const m of answer.matchAll(/\bCCC\s*(\d{1,4})\b/g)) {
    const n = Number(m[1]);
    if (!seen.includes(n)) seen.push(n);
  }
  return seen.slice(0, MAX_CITED);
}

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = (await req.json().catch(() => null)) as { question?: unknown } | null;
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    if (!question || question.length > MAX_QUESTION) return json({ error: 'invalid question' }, 400);

    const answer = await askCatechism(question);
    // Only paragraphs that exist at the source are returned, so every chip opens real Catechism text.
    const checked = await Promise.all(
      citedNumbers(answer).map((n) => fetchCatechism(n).then((p) => (p ? n : null), () => null)),
    );
    return json({ answer, paragraphs: checked.filter((n): n is number => n !== null) });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('catechism ask failed', e instanceof Error ? e.message : e);
    return json({ error: 'server error' }, 500);
  }
}
