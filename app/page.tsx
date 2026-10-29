import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Clock,
  CreditCard,
  Layers,
  MailCheck,
  MessageCircle,
  PhoneCall,
  type LucideIcon,
} from "lucide-react";
import { Mandala } from "@/components/art/mandala";
import { Particles } from "@/components/art/particles";
import { HeroFan } from "@/components/home/hero-fan";
import { ReadingsDeck } from "@/components/home/readings-deck";
import { SessionChoice } from "@/components/home/session-panel";
import { WordBand } from "@/components/home/word-bands";
import { Photo } from "@/components/media/photo";
import { Reveal } from "@/components/motion/reveal";
import { SplitWords } from "@/components/motion/split-words";
import { AskPanel } from "@/components/sections/ask-panel";
import { FaqList } from "@/components/sections/faq-list";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { RuleTitle } from "@/components/ui/rule-title";
import { SectionHeading } from "@/components/ui/section-heading";
import { services } from "@/content/services";
import { topicCards } from "@/content/topics";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";

const steps: ReadonlyArray<{ title: string; text: string; icon: LucideIcon }> = [
  { title: "Choose a reading", text: "Then pick a call or a text session.", icon: Layers },
  {
    title: "Pick a time",
    text: `${site.hours.daysShort}, ${site.hours.time} ${site.hours.timeZone}.`,
    icon: CalendarClock,
  },
  { title: "Pay online", text: "As the last step of booking.", icon: CreditCard },
  { title: "Get confirmed", text: `By email. Then ${site.firstName} reaches out.`, icon: MailCheck },
];

const heroFacts: ReadonlyArray<{ icon: LucideIcon; label: string }> = [
  { icon: PhoneCall, label: "Call" },
  { icon: MessageCircle, label: "Text" },
  { icon: Clock, label: `${site.hours.daysShort}, ${site.hours.time}` },
];

export default function HomePage() {
  return (
    <>
      {/* Hero: words on the left, three cards fanned on a turning mandala on the right. */}
      {/* Order on load: badge, title word by word, the line under it word by word,
          then the buttons and the icon row one at a time. */}
      <section className="relative overflow-hidden bg-linear-to-b from-white via-ivory to-white">
        {/* Soft warm light from the top left, behind the words. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -left-40 size-[42rem] rounded-full bg-[radial-gradient(circle,rgb(247_237_211/0.75),transparent_65%)]"
        />
        <Particles count={40} seed={5} />
        <Container className="relative grid items-center gap-8 pt-8 pb-16 lg:min-h-[min(calc(100svh-5rem),800px)] lg:grid-cols-[1fr_1fr] lg:gap-4 lg:py-10">
          <div className="relative text-center lg:text-left">
            <p className="inline-flex animate-rise items-center gap-2.5 rounded-full bg-white py-1.5 pr-4 pl-1.5 text-sm font-semibold text-ink shadow-soft ring-1 ring-gold-500/50">
              <span className="flex size-7 items-center justify-center rounded-full bg-gold-foil text-ink shadow-gold">
                <Layers className="size-3.5" strokeWidth={2} aria-hidden="true" />
              </span>
              With {site.owner}
            </p>
            <h1 className="hero-words mt-6 text-[3.2rem] leading-[1.02] sm:text-[4.5rem] lg:text-[5.3rem]">
              <SplitWords text="Clarity," accent={[0]} />
              <br />
              <SplitWords text="one card" start={1} />
              <br />
              <SplitWords text="at a time." start={3} />
            </h1>
            <p className="hero-sub mx-auto mt-6 max-w-md text-lg text-ink-muted [--sub-start:900ms] sm:text-xl lg:mx-0">
              <SplitWords text="Personal tarot and astrology readings, on a call or over text." />
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-4 lg:justify-start">
              <ButtonLink href="/book" className="animate-rise [animation-delay:1500ms]">
                Book a session
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink
                href="#readings"
                variant="outline"
                className="animate-rise [animation-delay:1620ms]"
              >
                Explore readings
              </ButtonLink>
            </div>
            <ul className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-3 text-[0.95rem] font-semibold text-ink lg:justify-start">
              {heroFacts.map(({ icon: Icon, label }, i) => (
                <li
                  key={label}
                  className="flex animate-rise items-center gap-2"
                  style={{ animationDelay: `${1800 + i * 130}ms` }}
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-champagne text-gold-800">
                    <Icon className="size-4" strokeWidth={1.9} aria-hidden="true" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <HeroFan />
        </Container>
        {/* Dissolves the warm light, rays and particles into the white page below. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-linear-to-b from-white/0 to-white lg:h-24"
        />
      </section>

      <WordBand />

      {/* Readings: a deck of engraved cards; the middle one turns over to book. */}
      <section id="readings" className="scroll-mt-24 overflow-x-clip py-16 lg:py-24">
        <Container>
          <RuleTitle eyebrow="Readings" title="Choose your reading" />
          <div className="mt-12 lg:mt-14">
            <ReadingsDeck services={services} />
          </div>
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
              const Icon = s.icon;
              return (
                <li key={s.title}>
                  <Reveal delay={i * 160} className="h-full">
                    <div
                      className={cn(
                        "group relative h-full overflow-hidden rounded-[28px] p-7 transition duration-500 ease-soft hover:-translate-y-2 hover:shadow-lift",
                        dark ? "grain-dark bg-night text-white" : "bg-white ring-1 ring-gold-500/60",
                      )}
                    >
                      <Mandala
                        className={cn(
                          "pointer-events-none absolute -right-20 -bottom-20 size-52 transition-[rotate] duration-[1400ms] ease-soft group-hover:rotate-45",
                          dark ? "text-gold-500/25" : "text-gold-500/30",
                        )}
                      />
                      {/* Top row: the step's icon on the left, its number on the right. */}
                      <div className="relative flex items-center justify-between">
                        <span
                          className={cn(
                            "flex size-16 items-center justify-center rounded-full ring-1 transition-transform duration-500 ease-soft group-hover:scale-105",
                            dark
                              ? "bg-night-700 text-gold-300 ring-gold-500/50"
                              : "bg-champagne text-gold-800 ring-gold-500/40",
                          )}
                        >
                          <Icon className="size-7" strokeWidth={1.6} aria-hidden="true" />
                        </span>
                        <span
                          className={cn(
                            "flex size-11 items-center justify-center rounded-full font-display text-xl font-semibold tabular ring-1",
                            dark ? "text-gold-300 ring-gold-500/50" : "text-gold-800 ring-gold-500/60",
                          )}
                        >
                          <span className="sr-only">Step </span>
                          {i + 1}
                        </span>
                      </div>
                      <h3 className={cn("relative mt-7 text-xl", dark && "text-white")}>{s.title}</h3>
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
          <Reveal className="mt-10">
            <AskPanel />
          </Reveal>
        </Container>
      </section>
    </>
  );
}
