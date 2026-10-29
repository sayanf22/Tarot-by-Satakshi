"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Mandala } from "@/components/art/mandala";
import { FlipCard } from "@/components/cards/flip-card";
import { CardBack } from "@/components/cards/tarot-faces";
import { useHoverTurn } from "@/components/cards/use-hover-turn";
import { TarotImage } from "@/components/media/tarot-image";
import { SampleTag } from "@/components/services/service-card";
import { cn } from "@/lib/cn";
import { formatDuration, formatPrice } from "@/lib/format";
import { categoryLabels, formatLabels, type Service } from "@/lib/types";

// One reading at a time, like the reference's "Voices of Transformation" slider:
// words on the left, the tarot card on the right, small square arrows either side.

function SquareArrow({
  dir,
  onClick,
  className,
}: {
  dir: "prev" | "next";
  onClick: () => void;
  className?: string;
}) {
  const Icon = dir === "prev" ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "prev" ? "Previous reading" : "Next reading"}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-gold-800 shadow-soft ring-1 ring-line transition duration-300 hover:-translate-y-0.5 hover:bg-gold-700 hover:text-white hover:ring-gold-700",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

// Mounted fresh for each reading (keyed by slug): dealt face down, then turns face up.
// Hover (or tap) turns it over.
function SlideCard({ service }: { service: Service }) {
  const [faceUp, setFaceUp] = useState(false);
  const { hovered, bind } = useHoverTurn<"card">();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => setFaceUp(true), reduce ? 0 : 450);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <button
      type="button"
      {...bind("card")}
      onClick={() => setFaceUp((v) => !v)}
      aria-pressed={faceUp}
      aria-label={`Turn over the ${service.name} card`}
      className="deal @container block w-full rotate-3 rounded-[6cqw] transition-[rotate,translate,scale] duration-700 ease-soft [--deal-r:-8deg] [--deal-y:30px] hover:-translate-y-2 hover:scale-[1.03] hover:rotate-0"
    >
      <FlipCard
        as="span"
        className="aspect-[7/12]"
        flipped={hovered ? !faceUp : faceUp}
        front={<CardBack />}
        back={
          <span className="block size-full overflow-hidden rounded-[6cqw] bg-white p-[3cqw] shadow-lift ring-1 ring-gold-500/60">
            <TarotImage
              id={service.card}
              sizes="250px"
              decorative
              className="size-full rounded-[4cqw] object-contain"
            />
          </span>
        }
      />
    </button>
  );
}

export function ReadingsSlider({ services }: { services: readonly Service[] }) {
  const n = services.length;
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const service = services[index]!;

  function go(next: number) {
    setIndex(((next % n) + n) % n);
  }

  function onPointerDown(e: PointerEvent) {
    startX.current = e.clientX;
  }

  function onPointerUp(e: PointerEvent) {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) > 45) go(index + (dx < 0 ? 1 : -1));
  }

  const meta = [
    service.durationMin ? formatDuration(service.durationMin) : null,
    service.pricePaise ? formatPrice(service.pricePaise) : null,
  ].filter(Boolean);

  return (
    <section aria-roledescription="carousel" aria-label="Readings">
      <div className="flex items-center justify-center gap-4 lg:gap-8">
        <SquareArrow dir="prev" onClick={() => go(index - 1)} className="hidden sm:flex" />

        <div
          className="relative w-full max-w-4xl overflow-hidden rounded-[36px] bg-ivory ring-1 ring-line"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (startX.current = null)}
        >
          <Mandala className="spin-slow pointer-events-none absolute -right-28 -bottom-28 w-[30rem] text-gold-500/25" />

          <div
            key={service.slug}
            className="relative grid items-center gap-10 p-8 sm:p-12 md:grid-cols-[1fr_auto] md:gap-14 lg:p-14"
          >
            <div aria-live="polite" className="order-2 animate-rise text-center md:order-1 md:text-left">
              <p className="eyebrow">
                {categoryLabels[service.category]} · {String(index + 1).padStart(2, "0")} /{" "}
                {String(n).padStart(2, "0")}
              </p>
              <h3 className="mt-4 text-[2.4rem] leading-[1.05] sm:text-[3.2rem]">{service.name}</h3>
              <p className="mx-auto mt-5 max-w-sm text-lg text-ink-muted md:mx-0">{service.summary}</p>
              <p className="mt-6 flex flex-wrap items-center justify-center gap-3 font-semibold text-ink md:justify-start">
                {service.formats.map((f) => formatLabels[f]).join(" or ")} session
                {meta.length ? (
                  <span className="text-gold-800 tabular">{meta.join(" · ")}</span>
                ) : service.sample ? (
                  <SampleTag />
                ) : null}
              </p>
              <Link
                href={`/book?service=${service.slug}`}
                className="group mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-gold-700 px-7 font-semibold text-white shadow-[0_12px_28px_-12px_rgb(110_82_32/0.75)] transition duration-300 hover:-translate-y-px hover:bg-gold-800"
              >
                Book this reading
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </div>

            <div className="order-1 mx-auto w-[min(62vw,250px)] md:order-2 md:w-[250px]">
              <SlideCard service={service} />
            </div>
          </div>
        </div>

        <SquareArrow dir="next" onClick={() => go(index + 1)} className="hidden sm:flex" />
      </div>

      <div className="mt-7 flex items-center justify-center gap-5">
        <SquareArrow dir="prev" onClick={() => go(index - 1)} className="sm:hidden" />
        <div className="flex items-center gap-2">
          {services.map((s, i) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => go(i)}
              aria-label={`Show ${s.name}`}
              aria-current={i === index ? "true" : undefined}
              className={cn(
                "h-1.5 rounded-full transition-all duration-500 ease-soft",
                i === index ? "w-8 bg-gold-700" : "w-1.5 bg-gold-500 hover:bg-gold-700",
              )}
            />
          ))}
        </div>
        <SquareArrow dir="next" onClick={() => go(index + 1)} className="sm:hidden" />
      </div>
    </section>
  );
}
