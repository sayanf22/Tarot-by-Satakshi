import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Particles } from "@/components/art/particles";
import { TarotArt } from "@/components/art/tarot-art";
import { HeroCard } from "@/components/home/hero-card";
import { ReadingsSlider } from "@/components/home/readings-slider";
import { SessionChoice } from "@/components/home/session-panel";
import { WordBand } from "@/components/home/word-bands";
import { Photo } from "@/components/media/photo";
import { Reveal } from "@/components/motion/reveal";
import { SplitWords } from "@/components/motion/split-words";
import { FaqList } from "@/components/sections/faq-list";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { RuleTitle } from "@/components/ui/rule-title";
import { SectionHeading } from "@/components/ui/section-heading";
import { services } from "@/content/services";
import { topicCards } from "@/content/topics";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";
import type { ServiceIcon } from "@/lib/types";

const steps: ReadonlyArray<{ title: string; text: string; icon: ServiceIcon }> = [
  { title: "Choose a reading", text: "Then pick a call or a text session.", icon: "cards" },
  {
    title: "Pick a time",
    text: `${site.hours.daysShort}, ${site.hours.time} ${site.hours.timeZone}.`,
    icon: "sun",
  },
  { title: "Pay online", text: "As the last step of booking.", icon: "wheel" },
  { title: "Get confirmed", text: `By email. Then ${site.firstName} reaches out.`, icon: "star" },
];

export default function HomePage() {
  return (
    <>
      {/* Hero: words on the left, a card on a turning mandala on the right (like the reference). */}
      <section className="relative overflow-hidden">
        <Particles count={30} seed={5} />
        <Container className="relative grid items-center gap-10 pt-8 pb-14 lg:min-h-[min(calc(100svh-5rem),780px)] lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:py-10">
          <div className="text-center lg:text-left">
            <p className="animate-rise eyebrow">With {site.owner}</p>
            <h1 className="hero-words mt-5 text-[3.1rem] leading-[1.02] sm:text-[4.4rem] lg:text-[5.2rem]">
              <SplitWords text="Clarity, one card at a time." accent={[0]} />
            </h1>
            <p className="mx-auto mt-6 max-w-md animate-rise text-lg text-ink-muted [animation-delay:500ms] sm:text-xl lg:mx-0">
              Personal tarot and astrology readings, on call or text.
            </p>
            <div className="mt-9 flex animate-rise flex-wrap justify-center gap-4 [animation-delay:650ms] lg:justify-start">
              <ButtonLink href="/book">
                Book a session
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="#readings" variant="outline">
                Explore readings
              </ButtonLink>
            </div>
          </div>
          <HeroCard />
        </Container>
      </section>

      <WordBand />

      {/* Readings: one at a time, words beside a real tarot card. */}
      <section id="readings" className="scroll-mt-24 py-16 lg:py-24">
        <Container>
          <RuleTitle eyebrow="Readings" title="Choose your reading" />
          <Reveal className="mt-12">
            <ReadingsSlider services={services} />
          </Reveal>
        </Container>
      </section>

      {/* About: a framed portrait and a short introduction (like the reference's "Who are" block). */}
      <section className="py-16 lg:py-24">
        <Container className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <Reveal className="mx-auto w-full max-w-[400px]">
            <div className="group grain-dark relative rounded-[36px] bg-night p-3 shadow-lift">
              <div className="overflow-hidden rounded-[28px]">
                <Photo
                  id="portrait"
                  sizes="(min-width: 1024px) 380px, 90vw"
                  className="h-auto w-full transition-transform duration-1000 ease-soft group-hover:scale-[1.03]"
                />
              </div>
            </div>
          </Reveal>
          <div className="text-center lg:text-left">
            <SectionHeading
              eyebrow="About"
              title={`Meet ${site.firstName}`}
              align="left"
              className="mx-auto lg:mx-0"
            />
            <Reveal delay={100}>
              <p className="mx-auto mt-6 max-w-lg text-lg text-ink-muted lg:mx-0">
                {site.owner} reads tarot and astrology for questions about love, career, family and life, on
                call or by text.
              </p>
              <p className="mt-8 text-sm font-bold tracking-[0.18em] text-gold-800 uppercase">Ask about</p>
              <ul className="mt-3 flex flex-wrap justify-center gap-2.5 lg:justify-start">
                {topicCards.map((t) => (
                  <li
                    key={t.value}
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink ring-1 ring-gold-500/60 transition-colors duration-300 hover:bg-champagne"
                  >
                    {t.title}
                  </li>
                ))}
              </ul>
              <Link
                href="/about"
                className="group mt-9 inline-flex items-center gap-2 font-bold text-gold-800 hover:text-ink"
              >
                More about {site.firstName}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* How it works: four cards, alternating dark and light (like the reference's card row). */}
      <section className="py-16 lg:py-24">
        <Container>
          <SectionHeading eyebrow="How it works" title="Four simple steps" />
          <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => {
              const dark = i % 2 === 0;
              return (
                <li key={s.title}>
                  <Reveal delay={i * 90} className="h-full">
                    <div
                      className={cn(
                        "group relative h-full overflow-hidden rounded-[28px] p-7 transition duration-500 ease-soft hover:-translate-y-2 hover:shadow-lift",
                        dark ? "grain-dark bg-night text-white" : "bg-white ring-1 ring-gold-500/60",
                      )}
                    >
                      <div className="relative flex items-start justify-between">
                        <span
                          className={cn(
                            "font-display text-sm font-bold tracking-[0.18em] tabular",
                            dark ? "text-gold-300" : "text-gold-800",
                          )}
                        >
                          STEP 0{i + 1}
                        </span>
                        <TarotArt
                          icon={s.icon}
                          className={cn(
                            "size-16 transition-transform duration-700 ease-soft group-hover:rotate-[30deg]",
                            dark ? "text-gold-500" : "text-gold-700",
                          )}
                        />
                      </div>
                      <h3 className={cn("relative mt-6 text-xl", dark && "text-white")}>{s.title}</h3>
                      <p className={cn("relative mt-2", dark ? "text-mist" : "text-ink-muted")}>{s.text}</p>
                    </div>
                  </Reveal>
                </li>
              );
            })}
          </ol>
        </Container>
      </section>

      {/* Call or text */}
      <section className="py-16 lg:py-24">
        <Container>
          <SessionChoice />
        </Container>
      </section>

      {/* FAQ */}
      <section className="py-16 lg:py-24">
        <Container className="max-w-3xl">
          <SectionHeading eyebrow="Good to know" title="Questions, answered" />
          <Reveal className="mt-10">
            <FaqList />
          </Reveal>
          <Reveal className="mt-10 text-center">
            <p className="text-ink-muted">
              Something else on your mind?{" "}
              <a href={site.phone.href} className="font-bold text-gold-800 hover:underline">
                Call {site.phone.display}
              </a>{" "}
              or{" "}
              <Link href="/contact" className="font-bold text-gold-800 hover:underline">
                send a message
              </Link>
              .
            </p>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
