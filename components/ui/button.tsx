import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "outline" | "light" | "ghost-light";
type Size = "md" | "sm";

type StyleProps = { variant?: Variant; size?: Size };

// Primary is polished gold foil with ink text (6.2:1 at the foil's darkest point).
// On hover the shine slides across and the glow grows.
const variants: Record<Variant, string> = {
  primary:
    "bg-gold-foil text-ink shadow-gold ring-1 ring-gold-600/40 ring-inset hover:bg-[position:100%_50%] hover:shadow-gold-lift disabled:bg-line disabled:bg-none disabled:text-ink-muted disabled:shadow-none disabled:ring-0",
  outline:
    "border border-gold-500 bg-white text-gold-800 hover:border-gold-600 hover:bg-champagne disabled:border-line disabled:text-ink-muted",
  light: "bg-white text-ink hover:bg-champagne",
  "ghost-light": "border border-gold-300/50 text-white hover:border-gold-300 hover:bg-white/10",
};

const sizes: Record<Size, string> = {
  md: "h-12 px-7 text-[0.95rem]",
  sm: "h-10 px-5 text-sm",
};

export function buttonClasses({ variant = "primary", size = "md" }: StyleProps = {}, className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap transition-all duration-500 ease-soft hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:hover:translate-y-0",
    variants[variant],
    sizes[size],
    className,
  );
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & StyleProps) {
  return <Link className={buttonClasses({ variant, size }, className)} {...props} />;
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & StyleProps) {
  return <button type={type} className={buttonClasses({ variant, size }, className)} {...props} />;
}
