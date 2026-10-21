import { validBulletinDate } from '@/lib/bulletin-text';
import { getBulletinPdf } from '@/lib/db/bulletins';

type Ctx = { params: Promise<{ date: string }> };

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const { date } = await params;
  if (!validBulletinDate(date)) return new Response('Invalid date', { status: 400 });

  let pdf: Uint8Array | null;
  try {
    pdf = await getBulletinPdf(date);
  } catch (e) {
    console.error('bulletin pdf failed', e instanceof Error ? e.message : e);
    return new Response('Lookup failed', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!pdf) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'public, s-maxage=60' } });
  return new Response(pdf as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="bulletin-${date}.pdf"`,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
