import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { TarotArt } from "@/components/art/tarot-art";
import { cn } from "@/lib/cn";
import { formatDuration, formatPrice, toRoman } from "@/lib/format";
import { categoryLabels, formatLabels, type Service } from "@/lib/types";

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

type Props = { service: Service; index: number; className?: string };

export function ServiceCard({ service, index, className }: Props) {
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col rounded-[28px] border border-line bg-white p-7 transition duration-500 ease-soft hover:-translate-y-1.5 hover:border-gold-500/60 hover:shadow-lift",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-ivory ring-1 ring-gold-500/25 transition-colors duration-500 group-hover:bg-champagne">
          <TarotArt icon={service.icon} className="size-11 text-gold-700" />
        </span>
        <span className="font-display text-lg text-gold-700">{toRoman(index + 1)}</span>
      </div>

      <p className="mt-7 eyebrow">{categoryLabels[service.category]}</p>
      <h3 className="mt-2 text-2xl text-ink">{service.name}</h3>
      <p className="mt-3 text-[0.975rem] leading-relaxed text-ink-muted">{service.summary}</p>

      <div className="mt-auto pt-7">
        <div className="flex items-center justify-between gap-4 border-t border-line pt-5">
          <span className="flex flex-col items-start gap-1.5">
            <ServiceMeta service={service} />
            <span className="text-sm font-medium text-ink-muted">
              {service.formats.map((f) => formatLabels[f]).join(" or ")}
            </span>
          </span>
          <Link
            href={`/book?service=${service.slug}`}
            aria-label={`Book ${service.name}`}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-gold-700/60 text-gold-800 transition-colors duration-300 group-hover:border-gold-700 group-hover:bg-gold-700 group-hover:text-white after:absolute after:inset-0 after:rounded-[28px] after:content-['']"
          >
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
