import { Marquee } from "@/components/motion/marquee";

const words = ["Clarity", "Intuition", "Guidance", "Balance", "Insight", "Purpose", "Love", "Career", "Calm"];

// One straight ribbon of words drifting left, on polished gold with ink lettering
// (6.2:1 at the gold's darkest point), edged top and bottom with a deep gold line.
export function WordBand() {
  return (
    <section aria-label="Clarity, intuition, guidance, balance, insight, purpose" className="py-6">
      <Marquee
        duration={45}
        gapClass="gap-8 pr-8"
        className="border-y border-gold-600 bg-gold-foil [background-size:100%_100%] py-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.5)]"
      >
        {words.map((w) => (
          <span key={w} className="flex items-center gap-8">
            <span className="font-display text-sm font-semibold tracking-[0.24em] text-ink uppercase sm:text-base">
              {w}
            </span>
            <span aria-hidden="true" className="size-1.5 rotate-45 bg-gold-800" />
          </span>
        ))}
      </Marquee>
    </section>
  );
}
