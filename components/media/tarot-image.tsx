import cards from "@/content/tarot-cards.json";
import { cn } from "@/lib/cn";

export type TarotCardId = keyof typeof cards;

type Props = {
  id: TarotCardId;
  sizes: string;
  className?: string;
  priority?: boolean;
  decorative?: boolean;
};

// Rider–Waite–Smith cards (Pamela Colman Smith, 1909; public domain), pre-sized by
// scripts/fetch-tarot-cards.mjs. Shown whole at their own shape.
export function TarotImage({ id, sizes, className, priority, decorative }: Props) {
  const c = cards[id];
  return (
    // oxlint-disable-next-line nextjs/no-img-element -- static export: files are pre-resized
    <img
      src={c.sources[0]!.src}
      srcSet={c.sources.map((s) => `${s.src} ${s.width}w`).join(", ")}
      sizes={sizes}
      width={c.width}
      height={c.height}
      alt={decorative ? "" : `${c.name} tarot card`}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={cn("block h-auto w-full", className)}
    />
  );
}

// The same card as gold line art on a transparent background (scripts/make-card-lineart.mjs).
// Always decorative: the card's title is written next to it.
export function TarotLineArt({ id, className }: { id: TarotCardId; className?: string }) {
  const line = cards[id].line;
  return (
    // oxlint-disable-next-line nextjs/no-img-element -- static export: file is pre-sized
    <img
      src={line.src}
      width={line.width}
      height={line.height}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn("block h-auto w-full", className)}
    />
  );
}
