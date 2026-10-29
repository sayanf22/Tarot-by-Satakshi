import { Reveal } from "@/components/motion/reveal";
import { SplitWords } from "@/components/motion/split-words";
import { cn } from "@/lib/cn";

// A line ending in an outlined diamond. The line draws itself outward from the title.
function Rule({ side }: { side: "left" | "right" }) {
  const left = side === "left";
  return (
    <svg
      viewBox="0 0 160 24"
      aria-hidden="true"
      fill="none"
      className={cn(
        "draw-x hidden h-6 w-24 shrink-0 text-gold-700 sm:block lg:w-40",
        left ? "origin-right" : "origin-left",
      )}
    >
      {left ? (
        <>
          <path
            d="M2 12 L14 2 L26 12 L14 22 Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M26 12 H158" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M2 12 H134" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path
            d="M134 12 L146 2 L158 12 L146 22 Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

// Title between two lines that end in a diamond, like the reference's "Voices of Transformation".
export function RuleTitle({
  title,
  eyebrow,
  className,
}: {
  title: string;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <Reveal className={cn("text-center", className)}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <div className="mt-3 flex items-center justify-center gap-5 lg:gap-7">
        <Rule side="left" />
        <h2 className="text-[2.3rem] sm:text-[3rem]">
          <SplitWords text={title} />
        </h2>
        <Rule side="right" />
      </div>
    </Reveal>
  );
}
