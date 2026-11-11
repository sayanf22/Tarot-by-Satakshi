import { DurationClock } from "@/components/ui/duration-clock";
import { cn } from "@/lib/cn";
import { formatPrice, formatSessionLength } from "@/lib/format";
import type { Service } from "@/lib/types";

// Small pieces shared by the reading cards and the booking steps.

export function SampleTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full bg-champagne px-2.5 py-0.5 text-[0.65rem] font-bold tracking-[0.16em] text-gold-800 uppercase",
        className,
      )}
    >
      Sample
    </span>
  );
}

/** The session length with a small clock, e.g. "◔ 1 hour session". */
export function SessionLength({ minutes, className }: { minutes: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <DurationClock minutes={minutes} className="text-gold-700" />
      {formatSessionLength(minutes)}
    </span>
  );
}

/** Length and price, e.g. "◔ 1 hour session · ₹199". */
export function ServiceMeta({ service }: { service: Service }) {
  if (!service.durationMin && !service.pricePaise) return service.sample ? <SampleTag /> : null;
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-1 font-semibold text-ink tabular">
      {service.durationMin ? <SessionLength minutes={service.durationMin} /> : null}
      {service.durationMin && service.pricePaise ? <span aria-hidden="true">·</span> : null}
      {service.pricePaise ? <span>{formatPrice(service.pricePaise)}</span> : null}
    </span>
  );
}
