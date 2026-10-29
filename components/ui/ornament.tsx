import { cn } from "@/lib/cn";

/** Four-point sparkle path centred on (cx, cy) with radius r (used in line art). */
export function sparklePath(cx: number, cy: number, r: number) {
  const k = r * 0.16;
  return `M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - r}Z`;
}

/** Small gold diamond, used as a separator. */
export function Diamond({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-1.5 shrink-0 rotate-45 bg-gold-500", className)}
    />
  );
}

/** Gold rule with a small diamond in the middle. */
export function Ornament({ className, width = "w-12" }: { className?: string; width?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex items-center justify-center gap-3", className)}>
      <span className={cn("h-px bg-linear-to-r from-transparent to-gold-500", width)} />
      <Diamond />
      <span className={cn("h-px bg-linear-to-l from-transparent to-gold-500", width)} />
    </div>
  );
}
