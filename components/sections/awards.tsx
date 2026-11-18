import { Award, Newspaper, type LucideIcon } from "lucide-react";
import { Photo, type PhotoId } from "@/components/media/photo";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { RuleTitle } from "@/components/ui/rule-title";
import { cn } from "@/lib/cn";
import photos from "@/content/photos.json";

// Satakshi's awards and press features, from the files she sent (18 Nov 2026).
// Wording is only what the award card and the magazine page themselves say.
const items: ReadonlyArray<{
  photo: PhotoId;
  icon: LucideIcon;
  label: string;
  title: string;
  text: string;
}> = [
  {
    photo: "awardHerstory",
    icon: Award,
    label: "Award · 2024",
    title: "HERstory Times Inspiration Awards 2024",
    text: "Recognised as a Tarot and Akashic Record Reader.",
  },
  {
    photo: "featureGlorious",
    icon: Newspaper,
    label: "Feature",
    title: "Featured in Glorious magazine",
    text: "A Journey into the Mystical Arts: a page on her path into tarot.",
  },
];

export function Awards({ className }: { className?: string }) {
  return (
    <section className={cn("py-16 lg:py-24", className)}>
      <Container>
        <RuleTitle eyebrow="Recognition" title="Awards and features" />
        <ul className="mx-auto mt-12 grid max-w-5xl items-start gap-8 sm:grid-cols-2 lg:gap-12">
          {items.map((it, i) => {
            const Icon = it.icon;
            const full = photos[it.photo].sources.at(-1)!.src;
            return (
              <li key={it.photo}>
                <Reveal delay={i * 140}>
                  <figure className="group">
                    {/* The frame takes the image's own shape, so nothing is cropped. */}
                    <a
                      href={full}
                      target="_blank"
                      rel="noopener"
                      className="block rounded-[32px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-700"
                      aria-label={`${it.title}: open full size`}
                    >
                      <div className="grain-dark relative rounded-[32px] bg-night p-3 shadow-lift transition duration-500 ease-soft group-hover:-translate-y-1.5">
                        <div className="overflow-hidden rounded-[24px]">
                          <Photo
                            id={it.photo}
                            sizes="(min-width: 1024px) 460px, (min-width: 640px) 45vw, 92vw"
                            className="h-auto w-full transition-transform duration-1000 ease-soft group-hover:scale-[1.03]"
                          />
                        </div>
                      </div>
                    </a>
                    <figcaption className="mt-6 flex items-start gap-4 px-1">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-champagne text-gold-800 ring-1 ring-gold-500/40">
                        <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                      </span>
                      <span>
                        <span className="block text-sm font-bold tracking-[0.14em] text-gold-800 uppercase">
                          {it.label}
                        </span>
                        <span className="mt-1 block font-display text-[1.6rem] leading-tight text-ink">
                          {it.title}
                        </span>
                        <span className="mt-2 block text-ink-muted">{it.text}</span>
                      </span>
                    </figcaption>
                  </figure>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
