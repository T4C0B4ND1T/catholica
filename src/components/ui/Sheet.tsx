"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { IconButton } from "./IconButton";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

/** Bottom sheet on mobile, centered dialog on desktop. Native <dialog>: focus trap, Escape, inert background. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={() => {
        opener.current?.focus();
        opener.current = null;
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) ref.current.close();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-lg border border-border bg-card p-0 text-foreground shadow-lg backdrop:bg-foreground/40 md:inset-auto md:left-1/2 md:top-1/2 md:max-w-[34em] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg"
    >
      {/* Padding lives here, not on <dialog>, so only true backdrop clicks target the dialog element. */}
      <div data-sheet-body className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-xl tracking-[-0.01em]">{title}</h2>
          <IconButton label="Close" onClick={() => ref.current?.close()}>
            <X size={20} strokeWidth={1.5} aria-hidden="true" />
          </IconButton>
        </div>
        {children}
      </div>
    </dialog>
  );
}
