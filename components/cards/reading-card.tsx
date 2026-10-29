"use client";

import Link from "next/link";
import { useRef, useState, type ComponentProps, type MouseEvent, type RefObject } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { FlipCard } from "@/components/cards/flip-card";
import { useHoverTurn } from "@/components/cards/use-hover-turn";
import { TarotImage, TarotLineArt } from "@/components/media/tarot-image";
import { SampleTag } from "@/components/services/service-card";
import { GlyphOrnament } from "@/components/ui/service-glyph";
import { cn } from "@/lib/cn";
import { formatDuration, formatPrice } from "@/lib/format";
import { sessionLabel, type Service } from "@/lib/types";

// A reading as a tall card, like the engraved cards in the client's "Offerings" reference.
// Front: gold line art, title, an icon ornament and one line of text.
// Back: the full colour Rider–Waite–Smith card with the session details and a Book link.
// Sizes are in container units (cqw), so the card looks the same at any width.

function ReadingFront({ service }: { service: Service }) {
  return (
    <div className="relative size-full rounded-[8cqw] bg-white p-[3.5cqw] shadow-lift ring-1 ring-gold-500/60">
      <div className="relative flex h-full flex-col items-center overflow-hidden rounded-[5.5cqw] border border-gold-500/45 bg-linear-to-b from-ivory via-white to-white px-[7cqw] pt-[6cqw] pb-[7cqw] text-center">
        <span className="relative min-h-0 w-[78%] flex-1">
          <TarotLineArt id={service.card} className="absolute inset-0 size-full object-contain" />
        </span>
        <h3 className="mt-[4cqw] font-display text-[max(1.3rem,8.6cqw)] leading-[1.05] text-ink">
          {service.name}
        </h3>
        <GlyphOrnament icon={service.icon} className="mt-[3.5cqw]" />
        <p className="mt-[3.5cqw] text-[max(0.82rem,5cqw)] leading-[1.45] text-ink-muted">
          {service.summary}
        </p>
      </div>
    </div>
  );
}

function ReadingBack({
  service,
  turned,
  onTurnBack,
  bookRef,
}: {
  service: Service;
  turned: boolean;
  onTurnBack: (e: MouseEvent<HTMLButtonElement>) => void;
  bookRef: RefObject<HTMLAnchorElement | null>;
}) {
  const meta = [
    service.durationMin ? formatDuration(service.durationMin) : null,
    service.pricePaise ? formatPrice(service.pricePaise) : null,
  ].filter(Boolean);

  return (
    <div className="grain-dark relative size-full rounded-[8cqw] bg-night p-[3.5cqw] shadow-lift ring-1 ring-night">
      <div className="relative flex h-full flex-col items-center overflow-hidden rounded-[5.5cqw] border border-gold-500/40 bg-[radial-gradient(circle_at_50%_30%,var(--color-night-700),var(--color-night)_75%)] px-[6cqw] pt-[6cqw] pb-[6.5cqw] text-center">
        <span className="relative min-h-0 w-full flex-1">
          <TarotImage
            id={service.card}
            sizes="(min-width: 1024px) 190px, 160px"
            decorative
            className="absolute inset-0 size-full object-contain"
          />
        </span>
        <p className="mt-[4cqw] font-display text-[max(1.25rem,8cqw)] leading-[1.05] text-white">
          {service.name}
        </p>
        <p className="mt-[2cqw] flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[max(0.8rem,4.6cqw)] font-semibold text-mist">
          {sessionLabel(service.formats)}
          {meta.length ? (
            <span className="text-gold-300 tabular">{meta.join(" · ")}</span>
          ) : service.sample ? (
            <SampleTag />
          ) : null}
        </p>
        <Link
          ref={bookRef}
          href={`/book?service=${service.slug}`}
          className="group mt-[4.5cqw] inline-flex h-[max(2.5rem,14cqw)] items-center gap-2 rounded-full bg-gold-700 px-[6cqw] text-[max(0.85rem,4.8cqw)] font-semibold whitespace-nowrap text-white transition-colors duration-300 hover:bg-gold-300 hover:text-ink"
        >
          Book this reading
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>

      {turned ? (
        <button
          type="button"
          onClick={onTurnBack}
          aria-label={`Turn the ${service.name} card back`}
          className="absolute top-[6.5cqw] right-[6.5cqw] flex size-9 items-center justify-center rounded-full bg-night text-gold-300 ring-1 ring-gold-500/50 transition-colors hover:bg-night-700"
        >
          <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

// A keyboard "click" has detail 0. Then focus follows the card to its other face,
// because the face that was focused becomes inert.
function focusSoon(target: RefObject<HTMLElement | null>, e: MouseEvent) {
  if (e.detail !== 0) return;
  requestAnimationFrame(() => target.current?.focus({ preventScroll: true }));
}

type ReadingCardProps = {
  service: Service;
  /** Which face shows. */
  flipped: boolean;
  /** Turned by a tap, click or key (rather than by hover): shows the "turn back" button. */
  turned: boolean;
  onTurn: () => void;
  onTurnBack: () => void;
  /** False for cards waiting at the side of a deck: nothing inside can be focused or clicked. */
  interactive?: boolean;
  className?: string;
} & Pick<ComponentProps<"div">, "onPointerEnter" | "onPointerLeave" | "onPointerMove">;

/** Controlled card: the parent decides when it is turned. */
export function ReadingCard({
  service,
  flipped,
  turned,
  onTurn,
  onTurnBack,
  interactive = true,
  className,
  ...pointer
}: ReadingCardProps) {
  const frontRef = useRef<HTMLButtonElement>(null);
  const bookRef = useRef<HTMLAnchorElement>(null);

  return (
    <div className={cn("@container relative", className)} inert={!interactive} {...pointer}>
      <FlipCard
        className="aspect-[7/11]"
        flipped={flipped}
        front={
          <>
            <ReadingFront service={service} />
            <button
              ref={frontRef}
              type="button"
              onClick={(e) => {
                onTurn();
                focusSoon(bookRef, e);
              }}
              aria-label={`Turn over the ${service.name} card`}
              className="absolute inset-0 rounded-[8cqw]"
            />
          </>
        }
        back={
          <ReadingBack
            service={service}
            turned={turned}
            bookRef={bookRef}
            onTurnBack={(e) => {
              onTurnBack();
              focusSoon(frontRef, e);
            }}
          />
        }
      />
    </div>
  );
}

/** A card that turns on its own: while a mouse is over it, or when tapped. */
export function TurnableReadingCard({ service, className }: { service: Service; className?: string }) {
  const [turned, setTurned] = useState(false);
  const { hovered, bind } = useHoverTurn<"card">();
  return (
    <ReadingCard
      service={service}
      flipped={turned || hovered === "card"}
      turned={turned}
      onTurn={() => setTurned(true)}
      onTurnBack={() => setTurned(false)}
      className={cn("transition-[translate] duration-500 ease-soft hover:-translate-y-1.5", className)}
      {...bind("card")}
    />
  );
}
