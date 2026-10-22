"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { CatechismParagraph } from "@/lib/sources/catechism";

const chip =
  "inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-md border border-border px-3 text-sm text-accent-ink hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const field =
  "w-full rounded-md border border-border bg-background p-3 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** The first line of a paragraph for a results list: whole words, cut near 120 characters. */
function preview(text: string): string {
  if (text.length <= 120) return text;
  const cut = text.slice(0, 120);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 60 ? cut.lastIndexOf(" ") : 120)}…`;
}

export function Catechism({ signedIn }: { signedIn: boolean }) {
  const [numInput, setNumInput] = useState("");
  const [para, setPara] = useState<CatechismParagraph | null>(null);
  const [results, setResults] = useState<{ q: string; total: number; paragraphs: CatechismParagraph[] } | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ answer: string; paragraphs: number[] } | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  async function load(n: number) {
    setNumInput(String(n));
    setResults(null);
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

  async function find(q: string) {
    setLoading(true);
    setLookupError(null);
    setPara(null);
    try {
      const res = await fetch(`/api/catechism/search?q=${encodeURIComponent(q)}`);
      if (res.status === 400) {
        setResults(null);
        setLookupError("Type a paragraph number, or two to 100 characters of words to search for.");
      } else if (!res.ok) {
        throw new Error();
      } else {
        const body = (await res.json()) as { total: number; paragraphs: CatechismParagraph[] };
        setResults({ q, ...body });
      }
    } catch {
      setResults(null);
      setLookupError("Could not search the Catechism. Check your connection and try again.");
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
          const q = numInput.trim();
          if (/^\d{1,4}$/.test(q)) void load(Number(q));
          else if (q) void find(q);
        }}
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="ccc-num" className="block text-sm text-muted-foreground">
            Paragraph number (1 to 2865) or words
          </label>
          <input
            id="ccc-num"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            maxLength={100}
            value={numInput}
            onChange={(e) => setNumInput(e.target.value)}
            className={`${field} mt-1 min-h-11`}
          />
        </div>
        <Button type="submit" variant="outline" disabled={loading || !numInput}>
          {loading ? "Loading" : /^\s*\d+\s*$/.test(numInput) || !numInput.trim() ? "Look up" : "Search"}
        </Button>
      </form>

      <div aria-live="polite">
        {lookupError && <p className="mt-3 text-sm text-foreground">{lookupError}</p>}
        {results && (
          <div className="mt-4" data-testid="ccc-results">
            <p className="text-sm text-muted-foreground">
              {results.total === 0
                ? `No paragraphs match “${results.q}”.`
                : results.total > results.paragraphs.length
                  ? `First ${results.paragraphs.length} of ${results.total} paragraphs`
                  : `${results.total} paragraph${results.total === 1 ? "" : "s"}`}
            </p>
            <ul className="mt-2">
              {results.paragraphs.map((p) => (
                <li key={p.num} className="border-t border-border first:border-t-0">
                  <button
                    type="button"
                    onClick={() => {
                      setResults(null);
                      setNumInput(String(p.num));
                      setPara(p);
                    }}
                    className="flex min-h-11 w-full touch-manipulation flex-col items-start py-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="small-caps text-sm text-accent-ink">§{p.num}</span>
                    <span className="break-words text-sm">{preview(p.text)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
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
                <p className="mt-3 text-sm text-muted-foreground">
                  {answer.paragraphs.length > 0
                    ? "Only the paragraphs below were checked against the Catechism."
                    : "No paragraph in this answer could be checked against the Catechism."}
                </p>
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
