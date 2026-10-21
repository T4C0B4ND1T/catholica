"use client";

import { useEffect } from "react";
import { todayInChicago } from "@/lib/dates";
import { offlineUrls } from "@/lib/offline/offline-urls";

/** Static files this page already loaded, so the worker can keep them for offline starts. */
function loadedAssets(): string[] {
  return performance
    .getEntriesByType("resource")
    .map((e) => new URL(e.name))
    .filter((u) => u.origin === location.origin && u.pathname.startsWith("/_next/static/"))
    .map((u) => u.pathname + u.search);
}

/**
 * Registers the offline service worker (production builds only) and asks it to save the coming week.
 * `bulletinDate` is the newest saved bulletin's Sunday, or null when there is none.
 */
export function ServiceWorker({ bulletinDate }: { bulletinDate: string | null }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        if (cancelled) return;
        registration.active?.postMessage({
          type: "prefetch",
          urls: offlineUrls(todayInChicago(), bulletinDate),
          bulletinDate,
          assets: loadedAssets(),
        });
      })
      .catch((e) => console.error("service worker registration failed", e));
    return () => {
      cancelled = true;
    };
  }, [bulletinDate]);
  return null;
}
