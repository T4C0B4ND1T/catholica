"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatDay, todayInChicago } from "@/lib/dates";
import { lastPrefetchRequest, offlineStatus, type OfflineStatus as Status } from "@/lib/offline/offline-urls";

/** What this phone has saved for use with no signal, and a button to save the coming week again now. */
export function OfflineStatus() {
  const [status, setStatus] = useState<Status | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => {
    offlineStatus(todayInChicago())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    refresh();
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type !== "prefetch-done") return;
      setSaving(false);
      refresh();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [refresh]);

  async function saveNow() {
    const request = lastPrefetchRequest();
    if (!request) return;
    setSaving(true);
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage(request);
  }

  // Unknown until mounted; null when there is no offline cache (development, or the worker never ran).
  if (status === undefined) return null;
  const last = status?.days.at(-1);

  return (
    <div data-testid="offline-status">
      <p className="text-sm">Saved for offline</p>
      <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
        {saving
          ? "Saving the coming week…"
          : last
            ? `Readings through ${formatDay(last)} (${status!.days.length} days)${status!.bulletin ? ", and the latest bulletin." : "."}`
            : "Nothing saved yet. Open the app with a signal and it saves the coming week."}
      </p>
      {lastPrefetchRequest() && (
        <Button className="mt-2" variant="outline" onClick={saveNow} disabled={saving}>
          Save the coming week now
        </Button>
      )}
    </div>
  );
}
