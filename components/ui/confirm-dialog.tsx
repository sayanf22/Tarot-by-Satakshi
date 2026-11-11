"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  /** The word the person must type to confirm. */
  word?: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * A confirmation window that only confirms when the person types the word (default "confirm").
 * Built on the native <dialog>, so Escape closes it, focus stays inside it, and the page behind
 * it can't be used while it is open.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  word = "confirm",
  confirmLabel,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const id = useId();
  const matches = typed.trim().toLowerCase() === word;

  // Only opens and closes the native dialog. The typed word is cleared when the person cancels
  // or confirms (below), not here, so nothing typed while the window is opening gets wiped.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      requestAnimationFrame(() => document.getElementById(`${id}-input`)?.focus());
    }
    if (!open && d.open) d.close();
  }, [open, id]);

  function cancel() {
    setTyped("");
    onCancel();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
      className="m-auto w-[min(92vw,28rem)] rounded-[28px] bg-white p-0 text-ink shadow-lift ring-1 ring-line backdrop:bg-ink/40"
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (matches && !busy) {
            setTyped("");
            onConfirm();
          }
        }}
        className="p-6 sm:p-7"
      >
        <h2 id={`${id}-title`} className="font-display text-2xl">
          {title}
        </h2>
        <div className="mt-3 text-sm text-ink-muted">{children}</div>
        <div className="mt-5">
          <Field
            id={`${id}-input`}
            label={`Type ${word} to continue`}
            hint={`Type the word "${word}" exactly, then press the button.`}
          >
            <TextInput
              id={`${id}-input`}
              value={typed}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => setTyped(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={cancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!matches || busy}>
            {busy ? "Saving…" : confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
