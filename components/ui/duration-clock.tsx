import { cn } from "@/lib/cn";

/**
 * A small clock face whose gold slice shows how much of an hour the session takes
 * (a full face for an hour or more). Decorative: the length is always written next to it.
 */
export function DurationClock({ minutes, className }: { minutes: number; className?: string }) {
  const part = Math.min(1, Math.max(0, minutes / 60));
  // Slice from 12 o'clock, clockwise.
  const angle = part * 2 * Math.PI;
  const x = 12 + 9 * Math.sin(angle);
  const y = 12 - 9 * Math.cos(angle);
  const large = part > 0.5 ? 1 : 0;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-4 shrink-0", className)}>
      <circle cx="12" cy="12" r="10.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {part >= 1 ? (
        <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.28" />
      ) : part > 0 ? (
        <path
          d={`M12 12 L12 3 A9 9 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`}
          fill="currentColor"
          opacity="0.28"
        />
      ) : null}
      <path d="M12 6.5V12l3.5 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
