import Link from "next/link";
import { cn } from "@/lib/cn";

type Props = { tone?: "dark" | "light"; className?: string; onClick?: () => void };

// Text wordmark until Satakshi shares her logo.
export function Wordmark({ tone = "dark", className, onClick }: Props) {
  const light = tone === "light";
  return (
    <Link
      href="/"
      onClick={onClick}
      aria-label="Tarot by Satakshi, home"
      className={cn("inline-flex flex-col items-center leading-none", className)}
    >
      <span
        className={cn(
          "text-[0.62rem] font-bold tracking-[0.44em] uppercase",
          light ? "text-gold-300" : "text-gold-700",
        )}
      >
        Tarot by
      </span>
      <span
        className={cn(
          "mt-1.5 font-display text-[1.55rem] font-semibold tracking-[0.04em]",
          light ? "text-white" : "text-ink",
        )}
      >
        Satakshi
      </span>
    </Link>
  );
}
