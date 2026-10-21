'use client';

import { Armchair, ChevronDown, Cross, HandHeart, PersonStanding, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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

  const badgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const steps = Array.from(document.querySelectorAll<HTMLElement>('[data-step]'));
    let frame = 0;

    // Current step: the last one whose top is at or above a line just below the sticky badge;
    // at the very bottom of the page, the last step.
    const update = () => {
      frame = 0;
      const line = (badgeRef.current?.getBoundingClientRect().bottom ?? 0) + 48;
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      let current = steps[0];
      if (atBottom) current = steps[steps.length - 1];
      else for (const s of steps) if (s.getBoundingClientRect().top <= line) current = s;
      const next = current?.dataset.posture as MassPosture | undefined;
      if (next && next in POSTURES) setPosture(next);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const { label, Icon } = POSTURES[posture];
  return (
    <div ref={badgeRef} className="sticky top-0 z-30 -mx-4 border-b border-border bg-background px-4 py-3">
      <div className="flex items-center justify-center gap-3" data-testid="posture-badge">
        <Icon size={32} strokeWidth={1.5} className="text-accent-ink" aria-hidden="true" />
        <span className="font-display text-2xl leading-none">
          <span className="sr-only">Current posture: </span>
          {label}
        </span>
      </div>
    </div>
  );
}
