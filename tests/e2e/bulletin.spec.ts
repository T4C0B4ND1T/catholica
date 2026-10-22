import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

const url = process.env.SUPABASE_TEST_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY;
const seeded = Boolean(url && serviceKey);

// 2099-01-04 is a Sunday. Clearly synthetic row and file, removed afterwards.
const SUNDAY = '2099-01-04';
const PATH = `e2e-synthetic/${SUNDAY}.pdf`;
const BUCKET = 'bulletins';
// An old bulletin whose PDF was deleted by the 12-week cleanup: row and text kept, storage_path null.
const PRUNED = '2097-01-06';

/** A minimal hand-built, valid one-page PDF. */
function tinyPdf(): Buffer {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

test.describe('Bulletin tab', () => {
  // One worker: beforeAll/afterAll seed and delete a shared row.
  test.describe.configure({ mode: 'serial' });
  let admin: SupabaseClient | undefined;

  test.beforeAll(async () => {
    if (!seeded) return;
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const up = await admin.storage.from(BUCKET).upload(PATH, tinyPdf(), { contentType: 'application/pdf', upsert: true });
    if (up.error) throw up.error;
    const { error } = await admin.from('bulletins').upsert({
      sunday_date: SUNDAY,
      source_url: 'https://example.invalid/synthetic-bulletin.pdf',
      storage_path: PATH,
      page_count: 1,
      text: 'SYNTHETIC TEST BULLETIN. Join us for the feast of Saint Anselm. <script>alert(1)</script>',
      summary: {
        massTimes: ['Saturday 4:00 PM (synthetic)'],
        confession: ['Saturday 3:00 PM (synthetic)'],
        announcements: [{ title: 'Synthetic festival', text: 'Not a real event.' }],
      },
    });
    if (error) throw error;
    const pruned = await admin.from('bulletins').upsert({
      sunday_date: PRUNED,
      source_url: 'https://example.invalid/synthetic-old-bulletin.pdf',
      storage_path: null,
      page_count: 1,
      text: 'SYNTHETIC OLD BULLETIN',
    });
    if (pruned.error) throw pruned.error;
  });

  test.afterAll(async () => {
    if (!admin) return;
    await admin.from('bulletins').delete().in('sunday_date', [SUNDAY, PRUNED]);
    await admin.storage.from(BUCKET).remove([PATH]);
  });

  test('seeded: newest card, search, viewer and PDF route', async ({ page, request }) => {
    test.skip(!seeded, 'needs SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_KEY');
    await page.goto('/bulletin');
    await expect(page.getByTestId('latest-bulletin')).toContainText('Jan 4, 2099');

    await page.getByRole('searchbox', { name: 'Search bulletins' }).fill('Anselm');
    const link = page.getByTestId('bulletin-results').getByRole('link').first();
    await expect(link).toHaveAttribute('href', `/bulletin/${SUNDAY}`);
    await expect(link.locator('mark')).toHaveText('Anselm');
    // Non-<mark> markup in the snippet is shown as text, never executed.
    await page.getByRole('searchbox', { name: 'Search bulletins' }).fill('script');
    await expect(page.getByTestId('bulletin-results').locator('script')).toHaveCount(0);

    await page.goto(`/bulletin/${SUNDAY}`);
    await expect(page.locator(`iframe[src="/api/bulletins/${SUNDAY}/pdf"]`)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open PDF' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Source: St. Anselm Parish' })).toHaveAttribute(
      'href',
      'https://example.invalid/synthetic-bulletin.pdf',
    );

    // The route never sends the bytes (real bulletins exceed Vercel's 4.5 MB limit): it redirects to a signed URL.
    const res = await request.get(`/api/bulletins/${SUNDAY}/pdf`, { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()['cache-control']).toBe('private, no-store');
    const location = res.headers()['location'];
    expect(location).toContain(`/storage/v1/object/sign/${BUCKET}/${PATH}?token=`);
    const pdf = await request.get(location);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
    // Followed as a browser would, the same path ends at the PDF.
    expect((await (await request.get(`/api/bulletins/${SUNDAY}/pdf`)).body()).subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('seeded: the AI summary shows above the PDF, and an old bulletin links to the parish copy', async ({ page, request }) => {
    test.skip(!seeded, 'needs SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_KEY');
    await page.goto(`/bulletin/${SUNDAY}`);
    const summary = page.getByTestId('bulletin-summary');
    await expect(summary).toContainText('Summarized by AI');
    await expect(summary).toContainText('Saturday 4:00 PM (synthetic)');
    await expect(summary).toContainText('Synthetic festival');

    await page.goto(`/bulletin/${PRUNED}`);
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.getByTestId('pdf-not-stored').getByRole('link', { name: 'Open it from St. Anselm' })).toHaveAttribute(
      'href',
      'https://example.invalid/synthetic-old-bulletin.pdf',
    );
    expect((await request.get(`/api/bulletins/${PRUNED}/pdf`)).status()).toBe(404);
  });

  test('search API returns empty for short queries', async ({ request }) => {
    const res = await request.get('/api/bulletins/search?q=a');
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ results: [] });
  });

  test('unknown date: viewer is 404, PDF route is plain 404, bad date is 400', async ({ page, request }) => {
    const viewer = await page.goto('/bulletin/2098-06-07');
    expect(viewer?.status()).toBe(404);
    expect((await request.get('/api/bulletins/nope/pdf')).status()).toBe(400);
    if (seeded) {
      const pdf = await request.get('/api/bulletins/2098-06-07/pdf');
      expect(pdf.status()).toBe(404);
      expect(pdf.headers()['content-type']).not.toContain('json');
    }
  });

  test('empty state renders without crashing', async ({ page }) => {
    test.skip(seeded, 'only meaningful when no bulletins exist');
    const res = await page.goto('/bulletin');
    expect(res?.status()).toBe(200);
    await expect(page.getByText('No bulletins saved yet.')).toBeVisible();
  });
});
