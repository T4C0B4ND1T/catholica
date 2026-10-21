import { readingSlotFor, type MassDialogueLine, type MassStepData } from '@/data/order-of-mass';
import type { DailyReadings } from '@/lib/types';

const SPEAKERS: Record<MassDialogueLine['speaker'], string> = {
  priest: 'Priest',
  people: 'People',
  deacon: 'Deacon',
  reader: 'Reader',
  all: 'All',
  rubric: 'Rubric',
};

function Dialogue({ lines }: { lines: MassDialogueLine[] }) {
  return (
    <div className="mt-3 space-y-3">
      {lines.map((l, i) => (
        <p key={i} className={l.speaker === 'rubric' ? 'text-sm italic text-muted-foreground' : ''}>
          {l.speaker !== 'rubric' && (
            <span className="small-caps mr-2 text-xs text-muted-foreground">{SPEAKERS[l.speaker]}</span>
          )}
          <span className={l.isResponse ? 'font-semibold' : ''}>{l.text}</span>
        </p>
      ))}
    </div>
  );
}

export function MassStep({ step, readings }: { step: MassStepData; readings: DailyReadings | null }) {
  const slot = readingSlotFor(step.id);
  const section = slot ? readings?.sections.find((s) => s.kind === slot) : undefined;

  return (
    <section
      id={step.id}
      data-step
      data-posture={step.posture}
      aria-labelledby={`${step.id}-title`}
      className="scroll-mt-32 border-b border-border py-6 last:border-b-0"
    >
      <h3 id={`${step.id}-title`} className="font-display text-xl leading-snug">
        {step.title}
      </h3>
      {section ? (
        <div className="mt-3" data-testid={`reading-${slot}`}>
          <p className="small-caps text-sm text-muted-foreground">
            {section.title}
            {section.citation && <> · {section.citation}</>}
          </p>
          <p className="mt-2 whitespace-pre-line leading-relaxed">{section.text}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            NABRE ·{' '}
            {readings?.sourceUrl ? (
              <a href={readings.sourceUrl} className="underline underline-offset-2">
                Source: USCCB
              </a>
            ) : (
              'Source: USCCB'
            )}
          </p>
        </div>
      ) : (
        <p className="mt-2 leading-relaxed">{step.summary}</p>
      )}
      {step.rubricNotes && <p className="mt-2 text-sm italic text-muted-foreground">{step.rubricNotes}</p>}
      {step.dialogue.length > 0 && (
        <details className="group mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring">
            Prayers and responses
          </summary>
          <Dialogue lines={step.dialogue} />
        </details>
      )}
      {step.alternateForms?.map((form) => (
        <details key={form.formId} className="mt-1">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring">
            {form.formName}
          </summary>
          <p className="mt-2 text-sm text-muted-foreground">{form.description}</p>
          <Dialogue lines={form.dialogue} />
        </details>
      ))}
    </section>
  );
}
