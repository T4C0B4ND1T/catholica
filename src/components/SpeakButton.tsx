"use client";

import { Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { readSpeechSettings } from "@/lib/speech-settings";
import { speakChunks } from "@/lib/speech";

const noopSubscribe = () => () => {};
// False on the server and during hydration, so unsupported browsers and the server render the same nothing.
const useSupported = () =>
  useSyncExternalStore(noopSubscribe, () => "speechSynthesis" in window, () => false);

const START_EVENT = "catholica:speak-start";

/** Reads `text` aloud with the saved voice and rate. Tapping again stops. Renders nothing without speech support. */
export function SpeakButton({ text, label }: { text: string; label: string }) {
  const supported = useSupported();
  const [speaking, setSpeaking] = useState(false);
  const run = useRef(0);

  function stop() {
    run.current += 1; // invalidates the running chain
    speechSynthesis.cancel();
    setSpeaking(false);
  }

  function start() {
    speechSynthesis.cancel();
    window.dispatchEvent(new CustomEvent(START_EVENT, { detail: run }));
    const id = ++run.current;
    const { voiceURI, rate } = readSpeechSettings();
    const voice = voiceURI ? speechSynthesis.getVoices().find((v) => v.voiceURI === voiceURI) : undefined;
    const chunks = speakChunks(text);
    if (chunks.length === 0) return;
    setSpeaking(true);
    const next = (i: number) => {
      if (id !== run.current) return;
      if (i >= chunks.length) return setSpeaking(false);
      const u = new SpeechSynthesisUtterance(chunks[i]);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      }
      u.rate = rate;
      u.onend = () => next(i + 1);
      u.onerror = () => {
        if (id === run.current) setSpeaking(false);
      };
      speechSynthesis.speak(u);
    };
    next(0);
  }

  // Another button starting, or leaving the page, ends this one.
  useEffect(() => {
    const onOtherStart = (e: Event) => {
      if ((e as CustomEvent).detail === run) return;
      run.current += 1;
      setSpeaking(false);
    };
    window.addEventListener(START_EVENT, onOtherStart);
    const ref = run;
    return () => {
      window.removeEventListener(START_EVENT, onOtherStart);
      if (ref.current > 0 && "speechSynthesis" in window) {
        ref.current += 1;
        speechSynthesis.cancel();
      }
    };
  }, []);

  if (!supported) return null;
  return (
    <button
      type="button"
      aria-label={speaking ? `Stop reading ${label}` : `Listen to ${label}`}
      aria-pressed={speaking}
      onClick={speaking ? stop : start}
      className="inline-flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 ease-out hover:bg-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {speaking ? (
        <Square aria-hidden="true" className="size-5 fill-accent text-accent" />
      ) : (
        <Volume2 aria-hidden="true" className="size-5" />
      )}
    </button>
  );
}
