import { Fragment } from 'react';
import { MassStep } from '@/components/MassStep';
import { MassWakeLock } from '@/components/MassWakeLock';
import { PostureBadge } from '@/components/PostureBadge';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { ORDER_OF_MASS_STEPS } from '@/data/order-of-mass';
import { addDays, todayInChicago } from '@/lib/dates';
import { getReadings } from '@/lib/db/readings';

function validDate(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  try {
    return addDays(value, 0) === value ? value : null;
  } catch {
    return null;
  }
}

export default async function MassPage({ searchParams }: { searchParams: Promise<{ date?: string | string[] }> }) {
  const date = validDate((await searchParams).date) ?? todayInChicago();
  const readings = await getReadings(date);
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`));

  return (
    <>
      <MassWakeLock />
      <h1 className="text-center font-display text-[2rem] leading-[1.1] tracking-[-0.02em]">Order of the Mass</h1>
      <p className="mt-2 mb-6 text-center text-muted-foreground">{readings?.feast || label}</p>
      <PostureBadge initial={ORDER_OF_MASS_STEPS[0].posture} />
      {ORDER_OF_MASS_STEPS.map((step, i) => (
        <Fragment key={step.id}>
          {(i === 0 || ORDER_OF_MASS_STEPS[i - 1].part !== step.part) && (
            <SectionLabel className="mt-10 mb-2">{step.partTitle}</SectionLabel>
          )}
          <MassStep step={step} readings={readings} />
        </Fragment>
      ))}
    </>
  );
}
