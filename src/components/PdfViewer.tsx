/** Full-width PDF embed with an "Open PDF" link, since iOS Safari shows only the first page in an iframe. */
export function PdfViewer({ src, title }: { src: string; title: string }) {
  return (
    <div>
      <iframe
        src={src}
        title={title}
        className="h-[70vh] w-full rounded-lg border border-border bg-card"
      />
      <p className="mt-4 text-center">
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center px-3 text-foreground underline decoration-accent underline-offset-4"
        >
          Open PDF
        </a>
      </p>
    </div>
  );
}
