import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export const bookingSteps = ["Reading", "Date & time", "Your details", "Review"] as const;
export type StepNumber = 1 | 2 | 3 | 4;

type Props = { current: StepNumber; onSelect: (step: StepNumber) => void };

export function StepIndicator({ current, onSelect }: Props) {
  return (
    <nav aria-label="Booking progress">
      <ol className="flex items-center gap-2 sm:gap-3">
        {bookingSteps.map((label, i) => {
          const n = (i + 1) as StepNumber;
          const done = n < current;
          const active = n === current;
          const content = (
            <>
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular transition-colors",
                  active && "border-gold-700 bg-gold-700 text-white",
                  done && "border-gold-700 bg-white text-gold-800",
                  !active && !done && "border-line bg-white text-ink-muted",
                )}
              >
                {done ? <Check className="size-4" aria-hidden="true" /> : n}
              </span>
              <span
                className={cn(
                  "text-sm font-semibold",
                  active ? "text-ink" : "text-ink-muted",
                  !active && "hidden md:inline",
                )}
              >
                {label}
              </span>
            </>
          );
          return (
            <li key={label} className="flex items-center gap-2 sm:gap-3">
              {done ? (
                <button
                  type="button"
                  onClick={() => onSelect(n)}
                  className="flex items-center gap-2 rounded-full hover:text-gold-800 sm:gap-3"
                  aria-label={`Step ${n}: ${label} (completed, go back)`}
                >
                  {content}
                </button>
              ) : (
                <span className="flex items-center gap-2 sm:gap-3" aria-current={active ? "step" : undefined}>
                  <span className="sr-only">{`Step ${n}: `}</span>
                  {content}
                </span>
              )}
              {n < 4 ? <span aria-hidden="true" className="h-px w-5 bg-line sm:w-8" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
