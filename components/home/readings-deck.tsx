"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ArrowLeft, ArrowRight, Hand } from "lucide-react";
import { ReadingCard } from "@/components/cards/reading-card";
import { cn } from "@/lib/cn";
import type { Service } from "@/lib/types";

// The readings as a deck, like the client's "Offerings & Insights" reference:
// the chosen card stands raised in the middle, the others wait smaller behind it.
// Arrows, dots, a swipe or a click on a side card brings a card to the middle;
// hovering or tapping the middle card turns it over to show the Book link.

/** Wait this long after the deck moves before a resting mouse turns the new card. */
const SETTLE_MS = 750;

/** Distance of card i from the middle card, from -n/2 to n/2 (the deck loops). */
function offsetOf(i: number, index: number, n: number) {
  let d = (((i - index) % n) + n) % n;
  if (d > n / 2) d -= n;
  return d;
}

// One transform per card, with the same list of functions in every state, so the
// browser interpolates each part on its own and the motion stays smooth.
function placement(d: number, spread: boolean): string {
  const abs = Math.min(Math.abs(d), 3);
  const sign = d < 0 ? -1 : 1;
  if (!spread) {
    // Gathered into a neat pile until the deck scrolls into view.
    return `translate3d(-50%, ${abs * 6}px, 0) rotateZ(${d * 2.5}deg) rotateY(0deg) scale(${1 - abs * 0.04})`;
  }
  const x = abs === 0 ? "-50%" : `calc(-50% + ${sign} * var(--s${abs}))`;
  const y = [0, 22, 40, 48][abs];
  const scale = [1, 0.86, 0.74, 0.66][abs];
  const turn = [0, 8, 10, 12][abs]! * -sign;
  return `translate3d(${x}, ${y}px, 0) rotateZ(0deg) rotateY(${turn}deg) scale(${scale})`;
}

function RoundArrow({ dir, onClick }: { dir: "prev" | "next"; onClick: (at: number) => void }) {
  const Icon = dir === "prev" ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      onClick={(e) => onClick(e.timeStamp)}
      aria-label={dir === "prev" ? "Previous reading" : "Next reading"}
      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-gold-800 shadow-soft ring-1 ring-gold-500 transition duration-300 ease-soft hover:-translate-y-0.5 hover:bg-gold-foil hover:text-ink hover:shadow-gold hover:ring-gold-600"
    >
      <Icon className="size-[1.1rem]" aria-hidden="true" />
    </button>
  );
}

export function ReadingsDeck({ services }: { services: readonly Service[] }) {
  const n = services.length;
  const [index, setIndex] = useState(0);
  const [spread, setSpread] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [turned, setTurned] = useState(false);
  // Cards that wrap round from one end of the deck to the other. They skip the
  // slide (which would cross in front of the others) and fade in at their new place.
  const [jumping, setJumping] = useState<ReadonlySet<number>>(() => new Set());

  const stageRef = useRef<HTMLDivElement>(null);
  const changedAt = useRef(0);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  // Spread the pile out once the deck is on screen. (With reduced motion the CSS
  // removes the transition, so the cards simply appear in place.)
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        changedAt.current = entry.time;
        setSpread(true);
        observer.disconnect();
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Let wrapped cards fade in one frame after they were moved without a transition.
  useEffect(() => {
    if (jumping.size === 0) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setJumping(new Set()));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [jumping]);

  /** Bring card `next` to the middle. `at` is the event's timestamp. */
  function go(next: number, at: number) {
    const target = ((next % n) + n) % n;
    if (target === index) return;
    const shift = offsetOf(target, index, n);
    const wrapped = new Set<number>();
    for (let i = 0; i < n; i++) {
      if (offsetOf(i, target, n) !== offsetOf(i, index, n) - shift) wrapped.add(i);
    }
    changedAt.current = at;
    setJumping(wrapped);
    setIndex(target);
    setHovered(false);
    setTurned(false);
  }

  // A resting mouse turns the middle card, but only once the deck has stopped moving.
  function onCardPointer(e: PointerEvent) {
    if (hovered || e.pointerType !== "mouse") return;
    if (e.timeStamp - changedAt.current > SETTLE_MS) setHovered(true);
  }

  function onCardLeave(e: PointerEvent) {
    if (e.pointerType === "mouse") setHovered(false);
  }

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY };
    swiped.current = false;
  }

  function onPointerUp(e: PointerEvent) {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      swiped.current = true;
      go(index + (dx < 0 ? 1 : -1), e.timeStamp);
    }
  }

  const active = services[index]!;

  return (
    <section aria-roledescription="carousel" aria-label="Readings">
      <div
        ref={stageRef}
        className={cn(
          "relative mx-auto [touch-action:pan-y] select-none [perspective:1600px]",
          "h-[calc(var(--w)*11/7+1.5rem)] [--s3:calc(var(--s2)+3rem)]",
          "[--s1:min(80px,21vw)] [--s2:min(96px,25vw)] [--w:min(230px,62vw)]",
          "sm:[--s1:160px] sm:[--w:250px] md:[--s2:270px] lg:[--s1:190px] lg:[--s2:330px] lg:[--w:270px]",
        )}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        onClickCapture={(e) => {
          // A swipe that ends on a card is not a click on it.
          if (!swiped.current) return;
          swiped.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {services.map((service, i) => {
          const d = offsetOf(i, index, n);
          const abs = Math.abs(d);
          const isActive = d === 0;
          const jump = jumping.has(i);
          return (
            <div
              key={service.slug}
              className={cn(
                "absolute top-4 left-1/2 w-[var(--w)] transition-[transform,opacity] duration-[850ms] ease-soft will-change-transform",
                (abs > 2 || jump) && "pointer-events-none opacity-0",
                abs === 2 && "max-md:pointer-events-none max-md:opacity-0",
              )}
              style={
                {
                  transform: placement(d, spread),
                  zIndex: 10 - abs,
                  transition: jump ? "none" : undefined,
                } as CSSProperties
              }
            >
              <ReadingCard
                service={service}
                interactive={isActive}
                flipped={isActive && spread && (hovered || turned)}
                turned={isActive && turned}
                onTurn={() => setTurned(true)}
                onTurnBack={() => {
                  setTurned(false);
                  setHovered(false);
                }}
                className={cn(
                  "transition-[translate] duration-500 ease-soft",
                  isActive ? "hover:-translate-y-1.5" : "",
                )}
                onPointerEnter={isActive ? onCardPointer : undefined}
                onPointerMove={isActive ? onCardPointer : undefined}
                onPointerLeave={isActive ? onCardLeave : undefined}
              />
              {isActive ? null : (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => go(i, e.timeStamp)}
                  aria-label={`Show ${service.name}`}
                  className="absolute inset-0 rounded-[8%]"
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        {active.name}
      </p>

      <p className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold text-ink-muted">
        <Hand className="size-4 text-gold-700" strokeWidth={1.75} aria-hidden="true" />
        Hover or tap the card to turn it
      </p>

      <div className="mt-6 flex items-center justify-center gap-5 sm:gap-7">
        <RoundArrow dir="prev" onClick={(at) => go(index - 1, at)} />
        <div className="flex items-center">
          {services.map((s, i) => (
            <button
              key={s.slug}
              type="button"
              onClick={(e) => go(i, e.timeStamp)}
              aria-label={`Show ${s.name}`}
              aria-current={i === index ? "true" : undefined}
              className="group flex h-8 items-center px-1.5"
            >
              <span
                className={cn(
                  "block h-2 rounded-full transition-all duration-500 ease-soft",
                  i === index ? "w-8 bg-gold-foil shadow-gold" : "w-2 bg-gold-500 group-hover:bg-gold-600",
                )}
              />
            </button>
          ))}
        </div>
        <RoundArrow dir="next" onClick={(at) => go(index + 1, at)} />
      </div>
    </section>
  );
}
