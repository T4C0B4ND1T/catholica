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
// Which button owns the synthesizer right now; only the owner may cancel it.
let currentOwner: number | null = null;
let nextOwner = 1;

/** Voices load asynchronously in some browsers: resolve once listed, or after a short wait. */
function voicesReady(): Promise<SpeechSynthesisVoice[]> {
  const now = speechSynthesis.getVoices();
  if (now.length > 0) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      speechSynthesis.removeEventListener("voiceschanged", done);
      clearTimeout(timer);
      resolve(speechSynthesis.getVoices());
    };
    const timer = setTimeout(done, 750);
    speechSynthesis.addEventListener("voiceschanged", done);
  });
}

/** Reads `text` aloud with the saved voice and rate. Tapping again stops. Renders nothing without speech support. */
export function SpeakButton({ text, label }: { text: string; label: string }) {
  const supported = useSupported();
  const [speaking, setSpeaking] = useState(false);
  const run = useRef(0);
  const [owner] = useState(() => nextOwner++);

  function stop() {
    run.current += 1; // invalidates the running chain
    if (currentOwner === owner) {
      currentOwner = null;
      speechSynthesis.cancel();
    }
    setSpeaking(false);
  }

  async function start() {
    const me = owner;
    const id = ++run.current;
    currentOwner = me;
    speechSynthesis.cancel();
    window.dispatchEvent(new CustomEvent(START_EVENT, { detail: me }));
    const chunks = speakChunks(text);
    if (chunks.length === 0) return;
    setSpeaking(true);
    const { voiceURI, rate } = readSpeechSettings();
    const voices = voiceURI ? await voicesReady() : [];
    if (id !== run.current || currentOwner !== me) return;
    const voice = voices.find((v) => v.voiceURI === voiceURI);
    const finish = () => {
      if (id !== run.current) return;
      if (currentOwner === me) currentOwner = null;
      setSpeaking(false);
    };
    const next = (i: number) => {
      if (id !== run.current) return;
      if (i >= chunks.length) return finish();
      const u = new SpeechSynthesisUtterance(chunks[i]);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      }
      u.rate = rate;
      u.onend = () => next(i + 1);
      u.onerror = finish;
      speechSynthesis.speak(u);
    };
    next(0);
  }

  // Another button starting ends this one; leaving the page cancels only our own speech.
  useEffect(() => {
    const me = owner;
    const onOtherStart = (e: Event) => {
      if ((e as CustomEvent).detail === me) return;
      run.current += 1;
      setSpeaking(false);
    };
    const release = () => {
      run.current += 1;
      if (currentOwner === me) {
        currentOwner = null;
        speechSynthesis.cancel();
      }
    };
    window.addEventListener(START_EVENT, onOtherStart);
    window.addEventListener("pagehide", release);
    return () => {
      window.removeEventListener(START_EVENT, onOtherStart);
      window.removeEventListener("pagehide", release);
      if ("speechSynthesis" in window) release();
    };
  }, [owner]);

  if (!supported) return null;
  return (
    <button
      type="button"
      aria-label={`Listen to ${label}`}
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
