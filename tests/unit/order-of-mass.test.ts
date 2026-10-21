import { describe, expect, it } from 'vitest';
import { ORDER_OF_MASS_STEPS, readingSlotFor } from '@/data/order-of-mass';
import type { ReadingKind } from '@/lib/types';

describe('order of the Mass data', () => {
  // The previous app's source file holds 28 steps (the design spec's "30" was a miscount).
  it('has 28 steps with unique ids and a posture each', () => {
    expect(ORDER_OF_MASS_STEPS).toHaveLength(28);
    expect(new Set(ORDER_OF_MASS_STEPS.map((s) => s.id)).size).toBe(28);
    for (const s of ORDER_OF_MASS_STEPS) expect(s.posture).toBeTruthy();
  });

  it('maps every reading kind except other and sequence from exactly one step', () => {
    const kinds: ReadingKind[] = ['reading1', 'psalm', 'reading2', 'alleluia', 'gospel'];
    for (const kind of kinds) {
      const steps = ORDER_OF_MASS_STEPS.filter((s) => readingSlotFor(s.id) === kind);
      expect(steps, kind).toHaveLength(1);
    }
    const mapped = ORDER_OF_MASS_STEPS.map((s) => readingSlotFor(s.id)).filter(Boolean);
    expect(mapped).toHaveLength(kinds.length);
    expect(readingSlotFor('homily')).toBeNull();
  });
});
