import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "outline" | "light" | "ghost-light";
type Size = "md" | "sm";

type StyleProps = { variant?: Variant; size?: Size };

const variants: Record<Variant, string> = {
  primary:
    "bg-gold-700 text-white shadow-[0_12px_28px_-12px_rgb(110_82_32/0.75)] hover:bg-gold-800 hover:shadow-[0_16px_34px_-12px_rgb(110_82_32/0.85)] disabled:bg-line disabled:text-ink-muted disabled:shadow-none",
  outline:
    "border border-gold-700/70 bg-white text-gold-800 hover:border-gold-700 hover:bg-ivory disabled:border-line disabled:text-ink-muted",
  light: "bg-white text-ink hover:bg-champagne",
  "ghost-light": "border border-white/30 text-white hover:border-white hover:bg-white/10",
};

const sizes: Record<Size, string> = {
  md: "h-12 px-7 text-[0.95rem]",
  sm: "h-10 px-5 text-sm",
};

export function buttonClasses({ variant = "primary", size = "md" }: StyleProps = {}, className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-all duration-300 ease-soft hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:hover:translate-y-0",
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
