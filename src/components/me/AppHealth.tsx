"use client";

import { Check, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatDay, todayInChicago } from "@/lib/dates";
import { healthProblems, jobLabel, type HealthReport } from "@/lib/health";

const when = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function Mark({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <Check size={16} strokeWidth={1.5} aria-label={`${label} saved`} className="text-lit-green" />
  ) : (
    <X size={16} strokeWidth={1.5} aria-label={`${label} missing`} className="text-lit-red" />
  );
}

/** Whether the daily jobs ran and what's saved around today, for spotting a problem before Sunday. */
export function AppHealth() {
  const [report, setReport] = useState<HealthReport | null | undefined>(undefined);

  const fetchReport = useCallback(() => {
    fetch("/api/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setReport)
      .catch(() => setReport(null));
  }, []);

  useEffect(fetchReport, [fetchReport]);

  function load() {
    setReport(undefined);
    fetchReport();
  }

  const today = todayInChicago();
  const problems = report ? healthProblems(report, today) : [];

  return (
    <section aria-labelledby="health-title" data-testid="app-health">
      <h2 id="health-title" className="font-display text-xl">
        App health
      </h2>
      <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
        {report === undefined
          ? "Checking…"
          : report === null
            ? "Couldn’t check right now. You may be offline."
            : problems.length === 0
              ? "Everything is saved and the jobs are running."
              : `${problems.length} ${problems.length === 1 ? "thing needs" : "things need"} a look.`}
      </p>
      {problems.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm" data-testid="health-problems">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {report && (
        <details className="mt-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring">
            Details
          </summary>
          <dl className="mt-2 space-y-3 text-sm">
            {report.jobs.map((j) => (
              <div key={j.job}>
                <dt className="small-caps text-muted-foreground">{jobLabel(j.job)}</dt>
                <dd>
                  {j.last ? (
                    <>
                      Last ran {when.format(new Date(j.last.at))} · {j.last.status === "ok" ? "OK" : "had trouble"}
                      {j.last.message && <span className="mt-0.5 block break-words text-xs text-muted-foreground">{j.last.message}</span>}
                    </>
                  ) : (
                    "Hasn’t run yet."
                  )}
                </dd>
              </div>
            ))}
            {report.bulletin && (
              <div>
                <dt className="small-caps text-muted-foreground">Newest bulletin</dt>
                <dd>
                  {formatDay(report.bulletin.sundayDate)} · {report.bulletin.summary ? "summarized" : "no summary yet"}
                  {report.bulletin.pdf ? "" : " · PDF not stored"}
                </dd>
              </div>
            )}
            <div>
              <dt className="small-caps text-muted-foreground">AI</dt>
              <dd>
                {report.model}
                {report.fallbacks.length > 0 && <span className="text-muted-foreground">, then {report.fallbacks.join(", ")}</span>}
              </dd>
            </div>
          </dl>
          <table className="mt-4 w-full text-sm">
            <caption className="small-caps mb-1 text-left text-muted-foreground">Past week and week ahead</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="py-1 font-normal">Day</th>
                <th scope="col" className="py-1 font-normal">Readings</th>
                <th scope="col" className="py-1 font-normal">Reflection</th>
                <th scope="col" className="py-1 font-normal">Insights</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {report.days.map((d) => (
                <tr key={d.date} className={d.date === today ? "font-semibold" : ""}>
                  <th scope="row" className="py-1.5 text-left font-[inherit]">
                    {formatDay(d.date)}
                    {d.questions !== null && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        Sunday questions {d.questions ? "saved" : "missing"}
                      </span>
                    )}
                  </th>
                  <td><Mark ok={d.readings} label="Readings" /></td>
                  <td><Mark ok={d.reflection} label="Reflection" /></td>
                  <td><Mark ok={d.insights} label="Insights" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      <Button className="mt-2" variant="outline" onClick={load} disabled={report === undefined}>
        Check again
      </Button>
    </section>
  );
}
