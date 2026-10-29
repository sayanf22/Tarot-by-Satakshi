import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/reveal";
import { SplitWords } from "@/components/motion/split-words";
import { cn } from "@/lib/cn";

type Props = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  align?: "center" | "left";
  as?: "h1" | "h2";
  className?: string;
};

// Clean heading like the reference: eyebrow, title, one line of text.
// Title words rise in one by one when the heading scrolls into view.
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  as: Heading = "h2",
  className,
}: Props) {
  const centered = align === "center";
  return (
    <Reveal className={cn(centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl", className)}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <Heading
        className={cn(
          "mt-3",
          // Page titles are on screen at load, so their words animate in straight away.
          Heading === "h1" ? "hero-words text-[2.8rem] sm:text-[3.6rem]" : "text-[2.3rem] sm:text-[3rem]",
        )}
      >
        <SplitWords text={title} />
      </Heading>
      {description ? <p className="mt-4 text-lg text-ink-muted">{description}</p> : null}
    </Reveal>
  );
}
