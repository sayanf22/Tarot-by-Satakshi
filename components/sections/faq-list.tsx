"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { faq } from "@/content/faq";
import { cn } from "@/lib/cn";

// Open, line-separated accordion (no boxes). One answer is open at a time.
// Panels open by animating the grid row from 0fr to 1fr, so the height eases to fit
// the text without measuring it. Closed panels are inert: hidden from tab order and
// screen readers, but still in the HTML for search engines.
export function FaqList({ firstOpen = true }: { firstOpen?: boolean }) {
  const [open, setOpen] = useState<number | null>(firstOpen ? 0 : null);
  const id = useId();

  return (
    <div className="divide-y divide-line border-y border-line">
      {faq.map((item, i) => {
        const isOpen = open === i;
        const qId = `${id}-q${i}`;
        const aId = `${id}-a${i}`;
        return (
          <div key={item.q}>
            <h3 className="text-[1.3rem]">
              <button
                type="button"
                id={qId}
                aria-expanded={isOpen}
                aria-controls={aId}
                onClick={() => setOpen(isOpen ? null : i)}
                className={cn(
                  "group flex w-full items-center justify-between gap-6 py-6 text-left transition-colors duration-300 hover:text-gold-800",
                  isOpen ? "text-gold-800" : "text-ink",
                )}
              >
                {item.q}
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color,color,rotate] duration-500 ease-soft",
                    isOpen
                      ? "rotate-45 border-gold-600 bg-gold-foil text-ink shadow-gold"
                      : "border-line text-ink group-hover:border-gold-500",
                  )}
                >
                  <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
                </span>
              </button>
            </h3>
            <section
              id={aId}
              aria-labelledby={qId}
              inert={!isOpen}
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-500 ease-soft",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <p
                  className={cn(
                    "max-w-2xl pr-14 pb-7 text-[1.02rem] text-ink-muted transition-[translate] duration-500 ease-soft",
                    isOpen ? "translate-y-0" : "-translate-y-2",
                  )}
                >
                  {item.a}
                </p>
              </div>
            </section>
          </div>
        );
      })}
    </div>
  );
}
