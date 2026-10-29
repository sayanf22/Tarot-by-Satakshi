import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  /** Shown first. */
  front: ReactNode;
  /** Shown after the card turns. */
  back: ReactNode;
  flipped: boolean;
  /** Use "span" when the card sits inside a button. */
  as?: "div" | "span";
  className?: string;
};

// A two-sided card. Give it a size (for example an aspect ratio); both faces fill it.
// The hidden face is inert, so its links and buttons can't be clicked or tabbed to.
// Hover turning is driven by the parent through `flipped`, so the visible face is
// always the interactive one.
export function FlipCard({ front, back, flipped, as: Tag = "div", className }: Props) {
  return (
    <Tag className={cn("flip block", className)} data-flipped={flipped}>
      <Tag className="flip-inner block">
        <Tag className="flip-face block" inert={flipped}>
          {front}
        </Tag>
        <Tag className="flip-face flip-face-up block" inert={!flipped}>
          {back}
        </Tag>
      </Tag>
    </Tag>
  );
}
