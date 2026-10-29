import { TarotArt } from "@/components/art/tarot-art";
import { Marquee } from "@/components/motion/marquee";
import { Reveal } from "@/components/motion/reveal";
import { SplitWords } from "@/components/motion/split-words";
import { Container } from "@/components/ui/container";
import type { ServiceIcon } from "@/lib/types";

const words: ReadonlyArray<{ word: string; icon: ServiceIcon }> = [
  { word: "Clarity", icon: "eye" },
  { word: "Intuition", icon: "moon" },
  { word: "Guidance", icon: "cards" },
  { word: "Balance", icon: "wheel" },
  { word: "Love", icon: "heart" },
  { word: "Insight", icon: "sun" },
  { word: "Career", icon: "cards" },
  { word: "Calm", icon: "moon" },
  { word: "Purpose", icon: "wheel" },
];

// A rounded champagne panel: a label, a headline whose words rise in slowly, and an
// endless strip of line-art words. The strip slides with a compositor-only transform,
// and two static gradients fade it out at the edges.
export function WordBand() {
  return (
    <section className="py-10 lg:py-14">
      <Container>
        <Reveal className="reveal-slow relative overflow-hidden rounded-[36px] bg-champagne py-14 ring-1 ring-gold-500/30 sm:py-20">
          {/* Soft light from the top edge. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(ellipse_at_50%_0%,rgb(255_255_255/0.7),transparent_70%)]"
          />

          <div className="relative px-6 text-center">
            <p className="reveal-late eyebrow text-gold-800!">
              <span className="block sm:inline">Tarot &amp; Astrology</span>
              <span aria-hidden="true" className="hidden sm:inline">
                {" · "}
              </span>
              <span className="mt-2 block sm:mt-0 sm:inline">Call or text</span>
            </p>
            <h2 className="mx-auto mt-5 max-w-3xl text-[2.1rem] leading-[1.12] sm:text-[2.9rem]">
              <SplitWords text="Readings on love, career and everything in between." accent={[2, 3]} />
            </h2>
          </div>

          <div className="reveal-late relative mt-12 sm:mt-14">
            <Marquee duration={55} gapClass="gap-12 pr-12 sm:gap-16 sm:pr-16">
              {words.map(({ word, icon }) => (
                <span key={word} className="flex items-center gap-3">
                  <TarotArt icon={icon} className="size-9 shrink-0 text-gold-700 sm:size-10" />
                  <span className="font-display text-xl font-semibold text-ink sm:text-2xl">{word}</span>
                </span>
              ))}
            </Marquee>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-linear-to-r from-champagne to-transparent sm:w-32"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-linear-to-l from-champagne to-transparent sm:w-32"
            />
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
