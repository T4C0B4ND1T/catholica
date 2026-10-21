"use client";

import { useSyncExternalStore } from "react";
import { clearPersonalCache } from "@/lib/offline/use-personal";
import { createBrowserClient } from "@/lib/db/browser";
import {
  MAX_RATE,
  MIN_RATE,
  SPEECH_RATE_KEY,
  SPEECH_VOICE_KEY,
  clampRate,
  useLocalSetting,
} from "@/lib/speech-settings";
import { Button } from "@/components/ui/Button";
import { MAX_TEXT_SCALE, MIN_TEXT_SCALE, useTheme, type ThemePreference } from "./ThemeProvider";

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "auto", label: "Auto" },
];

const noopSubscribe = () => () => {};
const useMounted = () =>
  useSyncExternalStore(noopSubscribe, () => true, () => false);

// A string snapshot ("uri\tname" per line) stays referentially stable between reads.
function subscribeVoices(cb: () => void) {
  if (typeof speechSynthesis === "undefined") return () => {};
  speechSynthesis.addEventListener("voiceschanged", cb);
  return () => speechSynthesis.removeEventListener("voiceschanged", cb);
}
function voicesSnapshot(): string {
  if (typeof speechSynthesis === "undefined") return "";
  return speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith("en"))
    .map((v) => `${v.voiceURI}\t${v.name}`)
    .join("\n");
}

const field =
  "min-h-11 w-full rounded-md border border-border bg-background px-3 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function SettingsPanel({ signedIn }: { signedIn: boolean }) {
  const mounted = useMounted();
  const { theme, setTheme, textScale, setTextScale } = useTheme();
  const [voice, setVoice] = useLocalSetting(SPEECH_VOICE_KEY, "");
  const [rateText, setRateText] = useLocalSetting(SPEECH_RATE_KEY, "1");
  const voices = useSyncExternalStore(subscribeVoices, voicesSnapshot, () => "")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [uri, name] = line.split("\t");
      return { uri, name };
    });
  const rate = clampRate(parseFloat(rateText));
  const percent = Math.round(textScale * 100);

  async function signOut() {
    await createBrowserClient().auth.signOut();
    await clearPersonalCache();
    window.location.reload();
  }

  return (
    <section aria-labelledby="settings-title" className="space-y-6">
      <h2 id="settings-title" className="font-display text-xl">
        Settings
      </h2>

      <div role="radiogroup" aria-label="Theme" className="flex rounded-md border border-border p-1">
        {THEMES.map((t) => {
          const selected = mounted && theme === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(t.value)}
              className={`min-h-11 flex-1 touch-manipulation rounded-sm px-3 text-sm transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                selected ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div>
        <label htmlFor="text-size" className="flex justify-between text-sm">
          <span>Text size</span>
          <span className="text-muted-foreground">{mounted ? `${percent}%` : ""}</span>
        </label>
        <input
          id="text-size"
          type="range"
          min={Math.round(MIN_TEXT_SCALE * 100)}
          max={Math.round(MAX_TEXT_SCALE * 100)}
          step={10}
          value={mounted ? percent : 100}
          onChange={(e) => setTextScale(Number(e.target.value) / 100)}
          className="mt-1 h-11 w-full accent-accent"
        />
      </div>

      <div>
        <label htmlFor="speech-voice" className="text-sm">
          Reading voice
        </label>
        <select
          id="speech-voice"
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          className={`${field} mt-1`}
        >
          <option value="">Device default</option>
          {voices.map((v) => (
            <option key={v.uri} value={v.uri}>
              {v.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="speech-rate" className="flex justify-between text-sm">
          <span>Reading speed</span>
          <span className="text-muted-foreground">{rate.toFixed(1)}×</span>
        </label>
        <input
          id="speech-rate"
          type="range"
          min={MIN_RATE}
          max={MAX_RATE}
          step={0.1}
          value={rate}
          onChange={(e) => setRateText(String(clampRate(Number(e.target.value))))}
          className="mt-1 h-11 w-full accent-accent"
        />
      </div>

      {signedIn && (
        <Button variant="outline" onClick={signOut}>
          Sign out
        </Button>
      )}
    </section>
  );
}
