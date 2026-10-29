"use client";

import { useEffect, useState, type PointerEvent } from "react";
import { Mandala } from "@/components/art/mandala";
import { FlipCard } from "@/components/cards/flip-card";
import { CardBack } from "@/components/cards/tarot-faces";
import { TarotImage, type TarotCardId } from "@/components/media/tarot-image";

// Hero visual: three Rider–Waite–Smith cards (public domain) on a slowly turning mandala.
// They arrive as a face-down pile, fan out, then turn face up one after another.
// A mouse over the fan opens it wider and lifts the card under it; a tap turns a card.

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

export function HeroFan() {
  const [fanned, setFanned] = useState(false);
  const [faceUp, setFaceUp] = useState<readonly boolean[]>([false, false, false]);
  const [open, setOpen] = useState(false);
  const [lifted, setLifted] = useState<number | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers = [
      window.setTimeout(() => setFanned(true), reduce ? 0 : 950),
      ...cards.map((_, i) =>
        window.setTimeout(
          () => setFaceUp((f) => f.map((v, j) => (j === i ? true : v))),
          reduce ? 0 : 1650 + i * 260,
        ),
      ),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const set = fanned ? (open ? poses.open : poses.fan) : poses.pile;

  function onFanEnter(e: PointerEvent) {
    if (e.pointerType === "mouse" && fanned) setOpen(true);
  }

  function onFanLeave(e: PointerEvent) {
    if (e.pointerType !== "mouse") return;
    setOpen(false);
    setLifted(null);
  }

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[560px] animate-rise [animation-delay:150ms]">
      <div
        aria-hidden="true"
        className="absolute inset-[13%] rounded-full bg-[radial-gradient(circle,var(--color-ivory)_55%,transparent_72%)]"
      />
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
                onClick={() => setFaceUp((f) => f.map((v, j) => (j === i ? !v : v)))}
                onPointerEnter={(e) => e.pointerType === "mouse" && setLifted(i)}
                onPointerLeave={(e) => e.pointerType === "mouse" && setLifted((l) => (l === i ? null : l))}
                aria-pressed={faceUp[i]}
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
                  flipped={faceUp[i]!}
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
