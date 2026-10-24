"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/db/browser";
import { STUDY_DEPTH_KEY, studyDepthOf } from "@/lib/study";
import type { StudyDepth } from "@/lib/types";

const OPTIONS: { value: StudyDepth; label: string }[] = [
  { value: "brief", label: "Brief" },
  { value: "sundays", label: "Sundays" },
  { value: "deep", label: "Every day" },
];

const HINT: Record<StudyDepth, string> = {
  brief: "Short study notes every day.",
  sundays: "The full study on Sundays and holy days, short notes on other days.",
  deep: "The full study every day.",
};

/**
 * How deep the study guide and the personal reflection go, saved on the account so the daily job can follow it. Days
 * already written change at the next morning's run.
 */
export function StudyDepthSetting() {
  const [depth, setDepth] = useState<StudyDepth | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    createBrowserClient()
      .auth.getUser()
      .then(({ data }) => !cancelled && setDepth(studyDepthOf(data.user?.user_metadata)))
      .catch(() => !cancelled && setDepth(studyDepthOf(null)));
    return () => {
      cancelled = true;
    };
  }, []);

  async function choose(value: StudyDepth) {
    const before = depth;
    setDepth(value);
    setFailed(false);
    const { error } = await createBrowserClient().auth.updateUser({ data: { [STUDY_DEPTH_KEY]: value } });
    if (error) {
      setDepth(before);
      setFailed(true);
    }
  }

  return (
    <div>
      <p id="study-depth-label" className="text-sm">
        Study guide depth
      </p>
      <div role="radiogroup" aria-labelledby="study-depth-label" className="mt-1 flex rounded-md border border-border p-1">
        {OPTIONS.map((o) => {
          const selected = depth === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={depth === null}
              onClick={() => choose(o.value)}
              className={`min-h-11 flex-1 touch-manipulation rounded-sm px-3 text-sm transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                selected ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-sm text-muted-foreground" role={failed ? "status" : undefined}>
        {failed ? "Couldn't save that. Check your connection and try again." : depth ? HINT[depth] : " "}
      </p>
    </div>
  );
}
