import { cn } from "@/lib/cn";
import { formatDuration, formatPrice } from "@/lib/format";
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

export function ServiceMeta({ service }: { service: Service }) {
  const parts = [
    service.durationMin ? formatDuration(service.durationMin) : null,
    service.pricePaise ? formatPrice(service.pricePaise) : null,
  ].filter(Boolean);
  if (parts.length === 0) return service.sample ? <SampleTag /> : null;
  return <span className="font-semibold text-ink tabular">{parts.join(" · ")}</span>;
}
