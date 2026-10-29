import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  children: ReactNode;
  /** Seconds for one full loop. */
  duration?: number;
  reverse?: boolean;
  /** Gap between items; also added after the last one so the loop is seamless. */
  gapClass?: string;
  className?: string;
};

// An endless strip. Two identical copies slide left by half the track's width.
// The second copy is hidden from screen readers and keyboard. Hover pauses it.
export function Marquee({ children, duration = 45, reverse, gapClass = "gap-4 pr-4", className }: Props) {
  return (
    <div className={cn("marquee-pause overflow-hidden", className)}>
      <div
        className={cn("marquee flex w-max", reverse && "marquee-reverse")}
        style={{ "--marquee-duration": `${duration}s` } as CSSProperties}
      >
        <div className={cn("flex shrink-0 items-center", gapClass)}>{children}</div>
        <div className={cn("flex shrink-0 items-center", gapClass)} aria-hidden="true" inert>
          {children}
        </div>
      </div>
    </div>
  );
}
