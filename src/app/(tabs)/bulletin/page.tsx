import Link from 'next/link';
import { BulletinSearch } from '@/components/BulletinSearch';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { formatDay } from '@/lib/dates';
import { listBulletins } from '@/lib/db/bulletins';
import type { Bulletin } from '@/lib/types';

const openClass =
  'inline-flex min-h-11 touch-manipulation items-center justify-center rounded-md bg-accent px-5 text-sm font-medium tracking-[0.05em] text-accent-foreground shadow-sm transition-all duration-200 ease-out hover:bg-accent-secondary hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

async function loadBulletins(): Promise<Bulletin[]> {
  try {
    return await listBulletins();
  } catch (e) {
    console.error('listBulletins failed', e instanceof Error ? e.message : e);
    return [];
  }
}

export default async function BulletinPage() {
  const bulletins = await loadBulletins();
  const [latest, ...rest] = bulletins;

  const byYear = new Map<string, Bulletin[]>();
  for (const b of rest) {
    const year = b.sundayDate.slice(0, 4);
    byYear.set(year, [...(byYear.get(year) ?? []), b]);
  }

  return (
    <>
      <h1 className="text-center font-display text-[2rem] leading-[1.1] tracking-[-0.02em]">Bulletin</h1>
      <p className="mt-2 mb-6 text-center text-muted-foreground">St. Anselm Parish</p>

      {!latest ? (
        <p className="py-10 text-center text-muted-foreground">No bulletins saved yet.</p>
      ) : (
        <>
          <Card featured data-testid="latest-bulletin">
            <p className="small-caps text-muted-foreground">Latest bulletin</p>
            <p className="mt-2 font-display text-2xl leading-tight">{formatDay(latest.sundayDate)}</p>
            <Link href={`/bulletin/${latest.sundayDate}`} className={`${openClass} mt-4`}>
              Open<span className="sr-only"> bulletin for {formatDay(latest.sundayDate)}</span>
            </Link>
          </Card>

          <SectionLabel className="mt-10">Search</SectionLabel>
          <BulletinSearch />

          {[...byYear.entries()].map(([year, items]) => (
            <section key={year} aria-labelledby={`year-${year}`}>
              <SectionLabel className="mt-10 mb-2">
                <span id={`year-${year}`}>{year}</span>
              </SectionLabel>
              <ul className="divide-y divide-border">
                {items.map((b) => (
                  <li key={b.sundayDate}>
                    <Link
                      href={`/bulletin/${b.sundayDate}`}
                      className="flex min-h-11 items-center py-2 hover:underline decoration-accent underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {formatDay(b.sundayDate)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </>
  );
}
