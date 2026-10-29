import { Marquee } from "@/components/motion/marquee";

const words = ["Clarity", "Intuition", "Guidance", "Balance", "Insight", "Purpose", "Love", "Career", "Calm"];

// One straight ribbon of words drifting left. White on gold-700 is 5.0:1.
export function WordBand() {
  return (
    <section aria-label="Clarity, intuition, guidance, balance, insight, purpose" className="py-6">
      <Marquee duration={45} gapClass="gap-8 pr-8" className="bg-gold-700 py-4">
        {words.map((w) => (
          <span key={w} className="flex items-center gap-8">
            <span className="font-display text-sm font-semibold tracking-[0.24em] text-white uppercase sm:text-base">
              {w}
            </span>
            <span aria-hidden="true" className="size-1.5 rotate-45 bg-gold-300" />
          </span>
        ))}
      </Marquee>
    </section>
  );
}
