"use client";

import { useEffect, useState } from "react";
import { Mandala } from "@/components/art/mandala";
import { FlipCard } from "@/components/cards/flip-card";
import { CardBack } from "@/components/cards/tarot-faces";
import { useHoverTurn } from "@/components/cards/use-hover-turn";
import { TarotImage } from "@/components/media/tarot-image";

// Hero visual: one tarot card (The Moon, Rider–Waite–Smith, public domain) resting on a
// slowly turning gold mandala.
// It is dealt face down, turns face up, and turns again while hovered (or when tapped).
export function HeroCard() {
  const [faceUp, setFaceUp] = useState(false);
  const { hovered, bind } = useHoverTurn<"card">();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => setFaceUp(true), reduce ? 0 : 1500);
    return () => window.clearTimeout(t);
  }, []);

  const showFace = hovered ? !faceUp : faceUp;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[540px] animate-rise [animation-delay:200ms]">
      <div aria-hidden="true" className="absolute inset-[15%] rounded-full bg-ivory" />
      <Mandala className="spin-slow pointer-events-none absolute inset-0 size-full text-gold-500/70" />

      <div className="absolute top-1/2 left-1/2 w-[36%] -translate-1/2">
        <div className="deal [--deal-r:-12deg] [--deal-y:60px]">
          <button
            type="button"
            {...bind("card")}
            onClick={() => setFaceUp((v) => !v)}
            aria-pressed={faceUp}
            aria-label="Turn over The Moon card"
            className="@container block w-full -rotate-6 rounded-[8cqw] transition-[rotate,translate,scale] duration-700 ease-soft hover:-translate-y-2 hover:scale-[1.04] hover:rotate-0"
          >
            <FlipCard
              as="span"
              className="aspect-[7/12]"
              flipped={showFace}
              front={<CardBack />}
              back={
                <span className="block size-full overflow-hidden rounded-[8cqw] bg-white p-[3cqw] shadow-lift ring-1 ring-gold-500/60">
                  <TarotImage
                    id="moon"
                    priority
                    sizes="(min-width: 1024px) 200px, 36vw"
                    className="size-full rounded-[5cqw] object-contain"
                  />
                </span>
              }
            />
          </button>
        </div>
      </div>
    </div>
  );
}
