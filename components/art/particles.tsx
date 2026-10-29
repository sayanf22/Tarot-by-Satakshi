import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

// Fine gold particles that drift slowly upward and fade, like dust in light.
// Positions come from a fixed seed, so the server-built HTML and the browser match.

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Props = { count?: number; seed?: number; className?: string };

export function Particles({ count = 28, seed = 7, className }: Props) {
  const rand = seeded(seed);
  const dots = Array.from({ length: count }, (_, i) => ({
    i,
    x: rand() * 100,
    y: 20 + rand() * 80,
    size: 2 + rand() * 3.5,
    o: 0.45 + rand() * 0.45,
    dx: (rand() - 0.5) * 40,
    dy: -(70 + rand() * 90),
    dur: 8 + rand() * 8,
    delay: -rand() * 14,
    glow: rand() < 0.35,
  }));

  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {dots.map((d) => (
        <span
          key={d.i}
          className={cn(
            "particle absolute rounded-full bg-gold-500",
            d.glow && "shadow-[0_0_10px_2px_rgb(198_161_91/0.45)]",
          )}
          style={
            {
              left: `${d.x}%`,
              top: `${d.y}%`,
              width: d.size,
              height: d.size,
              "--p-o": d.o,
              "--p-x": `${d.dx}px`,
              "--p-y": `${d.dy}px`,
              "--p-dur": `${d.dur}s`,
              "--p-delay": `${d.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
