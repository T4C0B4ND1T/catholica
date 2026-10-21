'use client';
import { useWakeLock } from '@/lib/wake-lock';

/** Renders nothing; keeps the screen awake while the Mass tab is open. */
export function MassWakeLock() {
  useWakeLock(true);
  return null;
}
