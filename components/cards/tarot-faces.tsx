import type { ReactNode } from "react";
import { Mandala } from "@/components/art/mandala";
import { TarotArt } from "@/components/art/tarot-art";
import { Diamond } from "@/components/ui/ornament";
import { cn } from "@/lib/cn";
import type { ServiceIcon } from "@/lib/types";

// Card faces sized in container units (cqw), so they look the same at any card width.
// They fill their parent, which sets the card's size and must be an @container.
// Built from spans so they can also sit inside buttons.

export function CardShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "relative block size-full rounded-[8cqw] bg-white p-[4cqw] shadow-lift ring-1 ring-gold-500/60",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The back of a tarot card: warm black with a gold mandala. */
export function CardBack() {
  return (
    <CardShell className="grain-dark bg-night p-[3.5cqw] ring-night">
      <span className="relative flex h-full items-center justify-center overflow-hidden rounded-[5.5cqw] border border-gold-500/40 bg-[radial-gradient(circle_at_50%_45%,var(--color-night-700),var(--color-night)_70%)]">
        <Mandala className="w-[86%] text-gold-500/85" />
        <Diamond className="absolute top-[6cqw] left-1/2 size-[3cqw] -translate-x-1/2" />
        <Diamond className="absolute bottom-[6cqw] left-1/2 size-[3cqw] -translate-x-1/2" />
      </span>
    </CardShell>
  );
}

/** The illustrated face of a Major Arcana card: white with gold art. */
export function ArcanaFace({ numeral, title, icon }: { numeral: string; title: string; icon: ServiceIcon }) {
  return (
    <CardShell>
      <span className="relative flex h-full flex-col items-center justify-between overflow-hidden rounded-[5.5cqw] border border-gold-500/50 bg-linear-to-b from-ivory to-white px-[6cqw] pt-[9cqw] pb-[10cqw]">
        <span className="font-display text-[9cqw] leading-none font-semibold text-gold-700 tabular">
          {numeral}
        </span>
        <span className="relative flex w-[86%] items-center justify-center">
          <span className="absolute inset-[8%] rounded-full bg-champagne" />
          <TarotArt icon={icon} className="relative w-[86%] text-gold-800" />
        </span>
        <span className="font-display text-[6cqw] leading-none font-semibold tracking-[0.14em] whitespace-nowrap text-ink uppercase">
          {title}
        </span>
      </span>
    </CardShell>
  );
}
