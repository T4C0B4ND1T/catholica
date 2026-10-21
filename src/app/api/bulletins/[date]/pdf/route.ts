import { validBulletinDate } from '@/lib/bulletin-text';
import { getBulletinPdfUrl } from '@/lib/db/bulletins';

type Ctx = { params: Promise<{ date: string }> };

/** How long the signed storage URL works. The redirect itself is never cached, so it never outlives the URL. */
const SIGNED_URL_SECONDS = 60 * 60;

/**
 * Redirects to a short-lived signed URL for the PDF in private storage. The bytes are not proxied: real bulletins are
 * over Vercel's 4.5 MB response limit. The service worker follows the redirect and saves the PDF under this path.
 */
export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const { date } = await params;
  if (!validBulletinDate(date)) return new Response('Invalid date', { status: 400 });

  let signed: string | null;
  try {
    signed = await getBulletinPdfUrl(date, SIGNED_URL_SECONDS);
  } catch (e) {
    console.error('bulletin pdf failed', e instanceof Error ? e.message : e);
    return new Response('Lookup failed', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!signed) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'public, s-maxage=60' } });
  return new Response(null, { status: 302, headers: { Location: signed, 'Cache-Control': 'private, no-store' } });
}
