import { Compass, Eye, Heart, Layers, Moon, Orbit, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ServiceIcon } from "@/lib/types";

// Small line icons for readings, used where numbers used to be.
const glyphs: Record<ServiceIcon, LucideIcon> = {
  cards: Layers,
  heart: Heart,
  sun: Sun,
  moon: Moon,
  star: Compass,
  wheel: Orbit,
  eye: Eye,
};

export function ServiceGlyph({ icon, className }: { icon: ServiceIcon; className?: string }) {
  const Icon = glyphs[icon];
  return <Icon aria-hidden="true" strokeWidth={1.75} className={cn("size-4", className)} />;
}

/** Gold rule with a round icon medallion in the middle (the card ornament). */
export function GlyphOrnament({
  icon,
  tone = "light",
  className,
}: {
  icon: ServiceIcon;
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <span aria-hidden="true" className={cn("flex items-center justify-center gap-[3cqw]", className)}>
      <span className="h-px w-[12cqw] bg-linear-to-r from-transparent to-gold-500" />
      <span
        className={cn(
          "flex size-[10cqw] min-h-7 min-w-7 items-center justify-center rounded-full ring-1",
          dark ? "bg-night-700 text-gold-300 ring-gold-500/50" : "bg-white text-gold-700 ring-gold-500/60",
        )}
      >
        <ServiceGlyph icon={icon} className="size-[4.8cqw] min-h-3.5 min-w-3.5" />
      </span>
      <span className="h-px w-[12cqw] bg-linear-to-l from-transparent to-gold-500" />
    </span>
  );
}
