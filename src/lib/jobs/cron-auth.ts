/** Guards cron routes: null when the bearer secret matches, otherwise a 401 response. */
export function assertCron(req: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) return null;
  return new Response('Unauthorized', { status: 401, headers: { 'cache-control': 'no-store' } });
}
