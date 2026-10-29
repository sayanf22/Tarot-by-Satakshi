import { CalendarDays, Check, ClipboardCheck, Layers, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

export const bookingSteps = ["Reading", "Date & time", "Your details", "Review"] as const;
export type StepNumber = 1 | 2 | 3 | 4;

const stepIcons = [Layers, CalendarDays, UserRound, ClipboardCheck] as const;

type Props = { current: StepNumber; onSelect: (step: StepNumber) => void };

export function StepIndicator({ current, onSelect }: Props) {
  return (
    <nav aria-label="Booking progress">
      <ol className="flex items-center gap-2 sm:gap-3">
        {bookingSteps.map((label, i) => {
          const n = (i + 1) as StepNumber;
          const done = n < current;
          const active = n === current;
          const Icon = done ? Check : stepIcons[i]!;
          const content = (
            <>
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color,color,scale] duration-500 ease-soft",
                  active && "scale-105 border-gold-600 bg-gold-foil text-ink shadow-gold",
                  done && "border-gold-500 bg-champagne text-gold-800",
                  !active && !done && "border-line bg-white text-ink-muted",
                )}
              >
                <Icon className="size-[1.1rem]" strokeWidth={done ? 2.25 : 1.75} aria-hidden="true" />
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
              {n < 4 ? (
                <span aria-hidden="true" className="relative h-px w-5 overflow-hidden bg-line sm:w-8">
                  <span
                    className={cn(
                      "absolute inset-0 origin-left bg-gold-500 transition-[scale] duration-700 ease-soft",
                      done ? "scale-x-100" : "scale-x-0",
                    )}
                  />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
