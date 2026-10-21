'use client';

import { Armchair, ChevronDown, Cross, HandHeart, PersonStanding, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { MassPosture } from '@/data/order-of-mass';

const POSTURES: Record<MassPosture, { label: string; Icon: LucideIcon }> = {
  stand: { label: 'Stand', Icon: PersonStanding },
  sit: { label: 'Sit', Icon: Armchair },
  kneel: { label: 'Kneel', Icon: HandHeart },
  bow: { label: 'Bow', Icon: ChevronDown },
  sign_of_cross: { label: 'Sign of the Cross', Icon: Cross },
};

/** Sticky posture indicator. Follows the step nearest the viewport top (elements marked [data-step]). */
export function PostureBadge({ initial }: { initial: MassPosture }) {
  const [posture, setPosture] = useState<MassPosture>(initial);

  useEffect(() => {
    const steps = Array.from(document.querySelectorAll<HTMLElement>('[data-step]'));
    const inBand = new Set<HTMLElement>();
    // Band just below the sticky badge; the topmost step inside it is the current one.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) inBand.add(e.target as HTMLElement);
          else inBand.delete(e.target as HTMLElement);
        }
        const current = steps.find((s) => inBand.has(s));
        const next = current?.dataset.posture as MassPosture | undefined;
        if (next && next in POSTURES) setPosture(next);
      },
      { rootMargin: '-140px 0px -65% 0px' },
    );
    steps.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  const { label, Icon } = POSTURES[posture];
  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-border bg-background px-4 py-3">
      <div className="flex items-center justify-center gap-3" data-testid="posture-badge">
        <Icon size={32} strokeWidth={1.5} className="text-accent" aria-hidden="true" />
        <span className="font-display text-2xl leading-none" aria-live="polite">
          <span className="sr-only">Current posture: </span>
          {label}
        </span>
      </div>
    </div>
  );
}
