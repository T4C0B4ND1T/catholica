'use client';

import { useSyncExternalStore } from 'react';

export const SPEECH_VOICE_KEY = 'catholica.speechVoice';
export const SPEECH_RATE_KEY = 'catholica.speechRate';
export const MIN_RATE = 0.8;
export const MAX_RATE = 1.2;

const EVENT = 'catholica:setting';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener('storage', cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener(EVENT, cb);
  };
}

/** A string setting backed by localStorage; renders `fallback` on the server and during hydration. */
export function useLocalSetting(key: string, fallback: string): [string, (v: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key) ?? fallback,
    () => fallback,
  );
  const setValue = (v: string) => {
    try {
      localStorage.setItem(key, v);
    } catch {
      /* storage unavailable: setting lasts until reload */
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return [value, setValue];
}

export function clampRate(r: number): number {
  return Number.isFinite(r) ? Math.min(MAX_RATE, Math.max(MIN_RATE, r)) : 1;
}

/** Saved speech settings for readers of text to speech. */
export function readSpeechSettings(): { voiceURI: string; rate: number } {
  return { voiceURI: read(SPEECH_VOICE_KEY) ?? '', rate: clampRate(parseFloat(read(SPEECH_RATE_KEY) ?? '1')) };
}
