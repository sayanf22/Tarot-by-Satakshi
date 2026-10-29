"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Mandala } from "@/components/art/mandala";
import { FlipCard } from "@/components/cards/flip-card";
import { CardBack } from "@/components/cards/tarot-faces";
import { TarotImage, type TarotCardId } from "@/components/media/tarot-image";

// Hero visual: three Rider–Waite–Smith cards (public domain) on a slowly turning mandala,
// in front of a soft gold glow, slow light rays and thin orbit rings.
//
// With a mouse: the cards arrive as a face-down pile, fan out and turn face up one after
// another; a mouse over the fan opens it wider and lifts the card under it.
// On phones and tablets (no hover): scrolling drives the same sequence. As the fan moves
// up the screen it spreads, then each card turns over in turn; scrolling back reverses it.
// A tap turns a single card either way.

const cards: ReadonlyArray<{ id: TarotCardId; name: string }> = [
  { id: "priestess", name: "The High Priestess" },
  { id: "moon", name: "The Moon" },
  { id: "wheel", name: "Wheel of Fortune" },
];

// [x, y] as a share of the card's own width and height, and a rotation in degrees.
type Pose = readonly [x: number, y: number, r: number];
const poses: Record<"pile" | "fan" | "open", readonly Pose[]> = {
  pile: [
    [-3, 2, -5],
    [0, 0, 0],
    [3, 2, 5],
  ],
  fan: [
    [-58, 7, -12],
    [0, -5, 0],
    [58, 7, 12],
  ],
  open: [
    [-80, 9, -17],
    [0, -8, 0],
    [80, 9, 17],
  ],
};

/**
 * How far the deal has got: 0 pile, 1 fanned, 2–4 that many cards minus one face up
 * (2 = first card up, 4 = all three up), 5 all up and fanned wide.
 */
type Stage = 0 | 1 | 2 | 3 | 4 | 5;

/** Scroll position of the fan → stage. 0 while its centre is at the bottom of the screen,
 *  the last stage once its centre has risen to about 40% from the top. */
function stageFromScroll(el: HTMLElement): Stage {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const p = (vh - (r.top + r.height / 2)) / (vh * 0.6);
  if (p < 0.08) return 0;
  if (p < 0.28) return 1;
  if (p < 0.48) return 2;
  if (p < 0.68) return 3;
  if (p < 0.92) return 4;
  return 5;
}

export function HeroFan() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage>(0);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [lifted, setLifted] = useState<number | null>(null);
  // A tap flips one card against the current stage. It is stored with the face the
  // stage gave the card at the time, so it expires by itself once the stage changes it.
  const [taps, setTaps] = useState<ReadonlyMap<number, boolean>>(() => new Map());

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (window.matchMedia("(hover: none)").matches) {
      let frame = 0;
      const update = () => {
        frame = 0;
        setStage(stageFromScroll(el));
      };
      const onScroll = () => {
        if (!frame) frame = requestAnimationFrame(update);
      };
      frame = requestAnimationFrame(update);
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      };
    }

    // With a mouse: a timed deal once the hero title is in.
    const at = reduce ? [0, 0, 0, 0] : [1100, 1800, 2080, 2360];
    const timers = at.map((ms, i) => window.setTimeout(() => setStage((i + 1) as Stage), ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const fanned = stage >= 1;
  const open = stage === 5 || (hoverOpen && fanned);
  const set = !fanned ? poses.pile : open ? poses.open : poses.fan;
  const baseUp = (i: number) => stage >= i + 2;
  const faceUp = (i: number) => (taps.get(i) === baseUp(i) ? !baseUp(i) : baseUp(i));

  function onTap(i: number) {
    setTaps((t) => {
      const next = new Map(t);
      if (next.get(i) === baseUp(i)) next.delete(i);
      else next.set(i, baseUp(i));
      return next;
    });
  }

  function onFanEnter(e: PointerEvent) {
    if (e.pointerType === "mouse") setHoverOpen(true);
  }

  function onFanLeave(e: PointerEvent) {
    if (e.pointerType !== "mouse") return;
    setHoverOpen(false);
    setLifted(null);
  }

  return (
    <div
      ref={rootRef}
      className="relative mx-auto aspect-square w-full max-w-[560px] animate-rise [animation-delay:150ms]"
    >
      {/* Backdrop, back to front: warm glow, slow rays, orbit rings. Clipped by the hero. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[30%] rounded-full bg-[radial-gradient(circle,var(--color-champagne)_0%,rgb(247_237_211/0.55)_30%,transparent_62%)]"
      />
      <div
        aria-hidden="true"
        className="spin-slow pointer-events-none absolute -inset-[45%] rounded-full [mask-image:radial-gradient(circle,black_18%,transparent_62%)] [animation-direction:reverse] [animation-duration:220s] [background:repeating-conic-gradient(from_0deg,rgb(212_165_66/0.18)_0deg_1.2deg,transparent_1.2deg_9deg)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[12%] rounded-full border border-gold-500/30"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[24%] rounded-full border border-dashed border-gold-500/25"
      />
      <div aria-hidden="true" className="absolute inset-[13%] rounded-full bg-white/70" />
      <Mandala className="spin-slow pointer-events-none absolute inset-0 size-full text-gold-500/70" />

      <div
        className="absolute inset-[8%] animate-float-slow"
        onPointerEnter={onFanEnter}
        onPointerLeave={onFanLeave}
      >
        <div className="deal absolute inset-0 [--deal-r:-6deg] [--deal-y:70px]">
          {cards.map((card, i) => {
            const [x, y, r] = set[i]!;
            const up = lifted === i;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => onTap(i)}
                onPointerEnter={(e) => e.pointerType === "mouse" && setLifted(i)}
                onPointerLeave={(e) => e.pointerType === "mouse" && setLifted((l) => (l === i ? null : l))}
                aria-pressed={faceUp(i)}
                aria-label={`Turn over ${card.name}`}
                className="@container absolute top-1/2 left-1/2 w-[34%] origin-[50%_90%] rounded-[8cqw] transition-transform duration-[900ms] ease-soft will-change-transform"
                style={{
                  transform: `translate3d(calc(-50% + ${x}%), calc(-50% + ${y - (up ? 6 : 0)}%), 0) rotate(${r}deg) scale(${up ? 1.06 : 1})`,
                  zIndex: up ? 5 : i === 1 ? 3 : 1 + i,
                }}
              >
                <FlipCard
                  as="span"
                  className="aspect-[7/12]"
                  flipped={faceUp(i)}
                  front={<CardBack />}
                  back={
                    <span className="block size-full overflow-hidden rounded-[8cqw] bg-white p-[3cqw] shadow-lift ring-1 ring-gold-500/60">
                      <TarotImage
                        id={card.id}
                        priority
                        decorative
                        sizes="(min-width: 1024px) 190px, 34vw"
                        className="size-full rounded-[5cqw] object-contain"
                      />
                    </span>
                  }
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
