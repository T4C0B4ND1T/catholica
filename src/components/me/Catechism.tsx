"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { CatechismParagraph } from "@/lib/sources/catechism";

const chip =
  "inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-md border border-border px-3 text-sm text-accent-ink hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const field =
  "w-full rounded-md border border-border bg-background p-3 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function Catechism({ signedIn }: { signedIn: boolean }) {
  const [numInput, setNumInput] = useState("");
  const [para, setPara] = useState<CatechismParagraph | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ answer: string; paragraphs: number[] } | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  async function load(n: number) {
    setNumInput(String(n));
    setLoading(true);
    setLookupError(null);
    try {
      const res = await fetch(`/api/catechism/${n}`);
      if (res.status === 404 || res.status === 400) {
        setPara(null);
        setLookupError(`No paragraph ${n}. Try a number from 1 to 2865.`);
      } else if (!res.ok) {
        throw new Error();
      } else {
        setPara((await res.json()) as CatechismParagraph);
      }
    } catch {
      setLookupError("Could not load the paragraph. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function ask() {
    setAsking(true);
    setAskError(null);
    try {
      const res = await fetch("/api/catechism/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) throw new Error();
      setAnswer(await res.json());
    } catch {
      setAnswer(null);
      setAskError("Could not get an answer. Try again in a moment.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <section aria-labelledby="ccc-title">
      <h2 id="ccc-title" className="font-display text-xl">
        Catechism
      </h2>

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(numInput);
          if (Number.isInteger(n) && n > 0) void load(n);
        }}
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="ccc-num" className="block text-sm text-muted-foreground">
            Paragraph number (1 to 2865)
          </label>
          <input
            id="ccc-num"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={numInput}
            onChange={(e) => setNumInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className={`${field} mt-1 min-h-11`}
          />
        </div>
        <Button type="submit" variant="outline" disabled={loading || !numInput}>
          {loading ? "Loading" : "Look up"}
        </Button>
      </form>

      <div aria-live="polite">
        {lookupError && <p className="mt-3 text-sm text-foreground">{lookupError}</p>}
        {para && (
          <Card className="mt-4">
            <p className="small-caps text-sm text-accent-ink">Catechism of the Catholic Church §{para.num}</p>
            {para.title && <p className="mt-1 text-sm text-muted-foreground">{para.title}</p>}
            <p className="mt-3 break-words">{para.text}</p>
            {para.footnotes.length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
                {para.footnotes.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
            {para.crossRefs.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">See also</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {para.crossRefs.map((n) => (
                    <button key={n} type="button" className={chip} onClick={() => void load(n)}>
                      §{n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <a
              href={para.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-11 items-center text-sm text-accent-ink underline underline-offset-4"
            >
              Source: catholiccrossreference.online
            </a>
          </Card>
        )}
      </div>

      {signedIn && (
        <div className="mt-8">
          <label htmlFor="ccc-question" className="block text-sm text-muted-foreground">
            Ask a question about Catholic teaching
          </label>
          <textarea
            id="ccc-question"
            rows={3}
            maxLength={500}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className={`${field} mt-1`}
          />
          <Button className="mt-2" variant="outline" onClick={() => void ask()} disabled={asking || !question.trim()}>
            {asking ? "Thinking" : "Ask"}
          </Button>
          <div aria-live="polite">
            {askError && <p className="mt-3 text-sm text-foreground">{askError}</p>}
            {answer && (
              <div className="mt-4 rounded-lg border border-border bg-card p-4">
                <p className="small-caps text-sm text-accent-ink">AI answer</p>
                <p className="mt-2 whitespace-pre-line break-words">{answer.answer}</p>
                {answer.paragraphs.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-muted-foreground">Verified paragraphs</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {answer.paragraphs.map((n) => (
                        <button key={n} type="button" className={chip} onClick={() => void load(n)}>
                          §{n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
