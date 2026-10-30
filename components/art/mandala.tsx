import { cn } from "@/lib/cn";

// Concentric line-art wheel, like the reference's hero mandala. Purely decorative.
// Strokes and the small round markers use currentColor.

// Rounded so the server and the browser print the same numbers (their trig
// functions can differ in the last digits, which breaks hydration).
const round = (v: number) => Math.round(v * 1000) / 1000;

function polar(r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [round(100 + r * Math.cos(a)), round(100 + r * Math.sin(a))] as const;
}

export function Mandala({ className, detailed = true }: { className?: string; detailed?: boolean }) {
  const spokes = Array.from({ length: 24 }, (_, i) => i * 15);
  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      className={cn("[&_*]:[vector-effect:non-scaling-stroke]", className)}
    >
      <circle cx="100" cy="100" r="96" strokeWidth="0.8" />
      <circle cx="100" cy="100" r="90" strokeWidth="0.6" strokeDasharray="1 3" />
      <circle cx="100" cy="100" r="74" strokeWidth="0.8" />
      <circle cx="100" cy="100" r="52" strokeWidth="0.8" />
      <circle cx="100" cy="100" r="30" strokeWidth="0.8" />
      {spokes.map((deg) => {
        const [x1, y1] = polar(deg % 30 === 0 ? 52 : 74, deg);
        const [x2, y2] = polar(90, deg);
        return <line key={`s${deg}`} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="0.6" />;
      })}
      {detailed
        ? Array.from({ length: 12 }, (_, i) => {
            const [x, y] = polar(63, i * 30 + 15);
            return <circle key={`d${i}`} cx={x} cy={y} r="2.2" strokeWidth="0.7" />;
          })
        : null}
      {/* Eight-point star in the centre ring. */}
      <path
        d="M100 70 L106 94 L130 100 L106 106 L100 130 L94 106 L70 100 L94 94 Z"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path
        d="M100 79 L103.5 96.5 L121 100 L103.5 103.5 L100 121 L96.5 103.5 L79 100 L96.5 96.5 Z"
        strokeWidth="0.6"
        strokeLinejoin="round"
        transform="rotate(45 100 100)"
      />
      {/* Round markers in the wheel's own colour, so they fade with it (no bright squares). */}
      <g className="fill-current stroke-none">
        <circle cx="100" cy="100" r="3.2" />
        {[0, 90, 180, 270].map((deg) => {
          const [x, y] = polar(96, deg);
          return <circle key={`g${deg}`} cx={x} cy={y} r="2.4" />;
        })}
      </g>
    </svg>
  );
}
