import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { sparklePath } from "@/components/ui/ornament";
import type { ServiceIcon } from "@/lib/types";

// Gold line art drawn on a 120 x 120 grid. Strokes stay 1.5px at any size.

function polar(r: number, deg: number, cx = 60, cy = 60) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
}

function rays(count: number, inner: number, outerLong: number, outerShort: number, offset = -90) {
  return Array.from({ length: count }, (_, i) => {
    const deg = offset + (360 / count) * i;
    const [x1, y1] = polar(inner, deg);
    const [x2, y2] = polar(i % 2 === 0 ? outerLong : outerShort, deg);
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
  });
}

const art: Record<ServiceIcon, ReactNode> = {
  cards: (
    <>
      <rect
        x="40"
        y="26"
        width="40"
        height="64"
        rx="5"
        transform="rotate(-16 60 96)"
        className="fill-white"
      />
      <rect x="40" y="26" width="40" height="64" rx="5" transform="rotate(16 60 96)" className="fill-white" />
      <rect x="40" y="22" width="40" height="66" rx="5" className="fill-white" />
      <rect x="45" y="27" width="30" height="56" rx="3" />
      <path d={sparklePath(60, 55, 11)} />
      <circle cx="60" cy="55" r="16" strokeDasharray="1.5 4" />
    </>
  ),
  heart: (
    <>
      <path d="M60 94C33 76 24 57 32 44c7-11 21-11 28 1 7-12 21-12 28-1 8 13-1 32-28 50Z" />
      <path d="M60 82C42 70 36 58 41 50c4-7 13-7 19 2 6-9 15-9 19-2 5 8-1 20-19 32Z" />
      <path d={sparklePath(92, 28, 7)} />
      <path d={sparklePath(26, 30, 4.5)} />
      <path d={sparklePath(98, 70, 3.5)} />
    </>
  ),
  sun: (
    <>
      <circle cx="60" cy="60" r="17" />
      <circle cx="60" cy="60" r="11" strokeDasharray="1.5 3.5" />
      {rays(16, 25, 46, 37)}
    </>
  ),
  moon: (
    <>
      <path d="M72 32A28 28 0 1 0 72 88A30 30 0 0 1 72 32Z" />
      <path d={sparklePath(88, 40, 7)} />
      <path d={sparklePath(84, 80, 4.5)} />
      <path d={sparklePath(30, 26, 3.5)} />
    </>
  ),
  star: (
    <>
      <path d={sparklePath(60, 60, 30)} />
      <path d={sparklePath(60, 60, 14)} />
      <circle cx="60" cy="60" r="42" strokeDasharray="1.5 5" />
      <path d={sparklePath(24, 26, 5)} />
      <path d={sparklePath(96, 94, 4)} />
    </>
  ),
  wheel: (
    <>
      <circle cx="60" cy="60" r="44" />
      <circle cx="60" cy="60" r="33" />
      <circle cx="60" cy="60" r="14" />
      {Array.from({ length: 12 }, (_, i) => {
        const [x1, y1] = polar(33, i * 30);
        const [x2, y2] = polar(44, i * 30);
        const [x3, y3] = polar(14, i * 30);
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} />
            <line x1={x3} y1={y3} x2={x1} y2={y1} strokeDasharray="1.5 4" />
          </g>
        );
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const [x, y] = polar(38.5, i * 30 + 15);
        return <circle key={i} cx={x} cy={y} r="1.6" className="fill-current" />;
      })}
      <path d={sparklePath(60, 60, 8)} />
    </>
  ),
  eye: (
    <>
      <path d="M20 66Q60 30 100 66Q60 100 20 66Z" />
      <circle cx="60" cy="66" r="14" />
      <circle cx="60" cy="66" r="5" />
      {[-150, -125, -100, -80, -55, -30].map((deg) => {
        const [x1, y1] = polar(30, deg, 60, 66);
        const [x2, y2] = polar(40, deg, 60, 66);
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} />;
      })}
      <path d={sparklePath(60, 14, 5)} />
    </>
  ),
};

export function TarotArt({ icon, className }: { icon: ServiceIcon; className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("[&_*]:[vector-effect:non-scaling-stroke]", className)}
    >
      {art[icon]}
    </svg>
  );
}
