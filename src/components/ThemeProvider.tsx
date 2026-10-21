"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { TEXT_SCALE_KEY, THEME_KEY } from "./theme-script";

export type ThemePreference = "light" | "dark" | "auto";

export const MIN_TEXT_SCALE = 0.9;
export const MAX_TEXT_SCALE = 1.5;

type ThemeContextValue = {
  theme: ThemePreference;
  setTheme: (t: ThemePreference) => void;
  textScale: number;
  setTextScale: (s: number) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: preference lasts for this session only */
  }
}

export function clampScale(s: number): number {
  if (!Number.isFinite(s)) return 1;
  return Math.min(MAX_TEXT_SCALE, Math.max(MIN_TEXT_SCALE, s));
}

function systemTheme(): "light" | "dark" {
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("auto");
  const [textScale, setTextScaleState] = useState(1);

  // Load saved preferences once on mount.
  useEffect(() => {
    const t = read(THEME_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    setThemeState(t === "light" || t === "dark" ? t : "auto");
    const s = parseFloat(read(TEXT_SCALE_KEY) ?? "");
    if (Number.isFinite(s)) setTextScaleState(clampScale(s));
  }, []);

  // Reflect the theme on <html>; in auto mode track the system setting.
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => root.setAttribute("data-theme", theme === "auto" ? systemTheme() : theme);
    apply();
    if (theme !== "auto") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-text-scale", String(textScale));
    root.style.setProperty("--text-scale", String(textScale));
  }, [textScale]);

  const setTheme = useCallback((t: ThemePreference) => {
    setThemeState(t);
    write(THEME_KEY, t);
  }, []);

  const setTextScale = useCallback((s: number) => {
    const v = clampScale(s);
    setTextScaleState(v);
    write(TEXT_SCALE_KEY, String(v));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, textScale, setTextScale }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
