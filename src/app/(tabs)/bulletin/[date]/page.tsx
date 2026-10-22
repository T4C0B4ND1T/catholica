import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PdfViewer } from '@/components/PdfViewer';
import { validBulletinDate } from '@/lib/bulletin-text';
import { formatDay } from '@/lib/dates';
import { getBulletin } from '@/lib/db/bulletins';
import type { Bulletin } from '@/lib/types';

export default async function BulletinViewerPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!validBulletinDate(date)) notFound();

  let bulletin: Bulletin | null = null;
  try {
    bulletin = await getBulletin(date);
  } catch (e) {
    console.error('getBulletin failed', e instanceof Error ? e.message : e);
  }
  if (!bulletin) notFound();

  return (
    <>
      <Link
        href="/bulletin"
        className="inline-flex min-h-11 items-center text-muted-foreground underline decoration-accent underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        All bulletins
      </Link>
      <h1 className="mt-2 mb-6 text-center font-display text-[2rem] leading-[1.1] tracking-[-0.02em]">
        {formatDay(date)}
      </h1>
      <PdfViewer src={`/api/bulletins/${date}/pdf`} title={`Bulletin for ${formatDay(date)}`} />
      <p className="mt-4 text-center text-sm">
        <a
          href={bulletin.sourceUrl || 'https://stanselmparish.org/bulletins'}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-muted-foreground underline decoration-accent underline-offset-4"
        >
          Source: St. Anselm Parish
        </a>
      </p>
    </>
  );
}
