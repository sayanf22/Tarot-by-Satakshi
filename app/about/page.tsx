import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarCheck,
  Clock,
  Compass,
  Heart,
  HeartPulse,
  PhoneCall,
  Sprout,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Mandala } from "@/components/art/mandala";
import { SessionChoice } from "@/components/home/session-panel";
import { Photo } from "@/components/media/photo";
import { TarotLineArt, type TarotCardId } from "@/components/media/tarot-image";
import { Reveal } from "@/components/motion/reveal";
import { SplitWords } from "@/components/motion/split-words";
import { AskPanel } from "@/components/sections/ask-panel";
import { BookingCta } from "@/components/sections/booking-cta";
import { FaqList } from "@/components/sections/faq-list";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Ornament } from "@/components/ui/ornament";
import { RuleTitle } from "@/components/ui/rule-title";
import { SectionHeading } from "@/components/ui/section-heading";
import { topicCards } from "@/content/topics";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";
import type { Topic } from "@/lib/validation/booking";

export const metadata: Metadata = {
  title: "About Satakshi",
  description:
    "Meet Satakshi Kapoor, who offers tarot and astrology readings on call and text, Monday to Saturday.",
};

// Copy uses only confirmed facts: her name, what she reads, call and text sessions,
// her hours, the topics on the booking form she approved, and how booking works.
// Her story, training and years of practice are added once she shares them.

const facts = [
  { icon: PhoneCall, title: "Call or text", text: "Choose how you'd like your session when you book." },
  { icon: Clock, title: site.hours.daysShort, text: `${site.hours.time} ${site.hours.timeZone}` },
  { icon: CalendarCheck, title: "Book online", text: "Pick a time, pay and get a confirmation email." },
];

const readings: ReadonlyArray<{ card: TarotCardId; label: string; title: string; text: string }> = [
  {
    card: "priestess",
    label: "Tarot",
    title: "Tarot readings",
    text: "Guidance on the question on your mind, whether it is about love, career, family or life in general.",
  },
  {
    card: "wheel",
    label: "Astrology",
    title: "Astrology readings",
    text: "Guidance from your birth chart. When you book, you share your date, time and place of birth.",
  },
];

const topicIcons: Record<Topic, LucideIcon> = {
  love: Heart,
  career: BriefcaseBusiness,
  money: Wallet,
  family: UsersRound,
  health: HeartPulse,
  spiritual: Sprout,
  general: Compass,
};

export default function AboutPage() {
  return (
    <>
      {/* Intro: framed photo and a short introduction. */}
      <section>
        <Container className="grid items-center gap-14 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:py-20">
          {/* The frame takes the photo's own shape, so nothing is cropped. */}
          <div className="mx-auto w-full max-w-[440px] animate-rise">
            <div className="grain-dark relative rounded-[36px] bg-night p-3 shadow-lift">
              <div className="overflow-hidden rounded-[28px]">
                <Photo
                  id="terrace"
                  priority
                  sizes="(min-width: 1024px) 420px, 90vw"
                  className="h-auto w-full"
                />
              </div>
            </div>
          </div>

          <div className="max-w-xl text-center lg:text-left">
            <p className="animate-rise eyebrow">About</p>
            <h1 className="hero-words mt-4 text-[2.6rem] sm:text-[3.6rem]">
              <SplitWords text={`Meet ${site.firstName}`} />
            </h1>
            <Ornament className="mt-6 animate-rise [animation-delay:500ms] lg:justify-start" />
            <p className="hero-sub mt-8 text-lg text-ink-muted [--sub-start:600ms] sm:text-xl">
              <SplitWords
                text={`${site.owner} offers tarot and astrology readings for questions about love, career, family and life, on a call or over text.`}
              />
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4 lg:justify-start">
              <ButtonLink href="/book" className="animate-rise [animation-delay:1300ms]">
                Book a session
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink
                href="/services"
                variant="outline"
                className="animate-rise [animation-delay:1420ms]"
              >
                See readings
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>

      {/* Three quick facts. */}
      <section aria-label="At a glance" className="py-12 lg:py-16">
        <Container>
          <ul className="grid gap-5 sm:grid-cols-3">
            {facts.map(({ icon: Icon, title, text }, i) => {
              const dark = i === 1;
              return (
                <li key={title}>
                  <Reveal delay={i * 140} className="h-full">
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
                      <span
                        className={cn(
                          "relative flex size-16 items-center justify-center rounded-full ring-1 transition-transform duration-500 ease-soft group-hover:scale-105",
                          dark
                            ? "bg-night-700 text-gold-300 ring-gold-500/50"
                            : "bg-champagne text-gold-800 ring-gold-500/40",
                        )}
                      >
                        <Icon className="size-7" strokeWidth={1.6} aria-hidden="true" />
                      </span>
                      <h2 className={cn("relative mt-7 text-2xl", dark && "text-white")}>{title}</h2>
                      <p className={cn("relative mt-2", dark ? "text-mist" : "text-ink-muted")}>{text}</p>
                    </div>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* What she reads: tarot and astrology, each with its engraved card. */}
      <section className="py-16 lg:py-24">
        <Container>
          <RuleTitle eyebrow="Her readings" title="What she reads" />
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {readings.map((r, i) => (
              <Reveal key={r.card} delay={i * 140} className="h-full">
                <article className="group relative flex h-full flex-col items-center gap-8 overflow-hidden rounded-[32px] bg-ivory p-8 text-center ring-1 ring-line transition duration-500 ease-soft hover:-translate-y-1.5 hover:shadow-lift sm:flex-row sm:p-10 sm:text-left">
                  <div className="relative w-36 shrink-0 rounded-t-full rounded-b-[24px] bg-white p-4 pt-8 ring-1 ring-gold-500/50 transition-transform duration-700 ease-soft group-hover:-rotate-2 sm:w-40">
                    <TarotLineArt id={r.card} />
                  </div>
                  <div>
                    <p className="eyebrow">{r.label}</p>
                    <h3 className="mt-3 text-[1.9rem]">{r.title}</h3>
                    <p className="mt-3 text-[1.05rem] text-ink-muted">{r.text}</p>
                    <Link
                      href="/services"
                      className="group/link mt-6 inline-flex items-center gap-2 font-bold text-gold-800"
                    >
                      <span className="relative">
                        See readings
                        <span
                          aria-hidden="true"
                          className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-gold-700 transition-transform duration-500 ease-soft group-hover/link:scale-x-100"
                        />
                      </span>
                      <ArrowRight
                        className="size-4 transition-transform group-hover/link:translate-x-1"
                        aria-hidden="true"
                      />
                    </Link>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* What you can ask about: the topics from the booking form, beside her portrait. */}
      <section className="py-16 lg:py-24">
        <Container className="grid items-center gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <Reveal className="mx-auto w-full max-w-[380px]">
            <div className="grain-dark relative rounded-[36px] bg-night p-3 shadow-lift">
              <div className="overflow-hidden rounded-[28px]">
                <Photo id="portrait" sizes="(min-width: 1024px) 360px, 90vw" className="h-auto w-full" />
              </div>
            </div>
          </Reveal>
          <div>
            <SectionHeading
              eyebrow="Ask about"
              title="What you can bring to a reading"
              description="Pick a topic when you book. Not sure where to start? Choose a general reading."
              align="left"
              className="mx-auto text-center lg:mx-0 lg:text-left"
            />
            <ul className="mt-10 grid gap-3 sm:grid-cols-2">
              {topicCards.map((t, i) => {
                const Icon = topicIcons[t.value];
                return (
                  <li key={t.value}>
                    <Reveal delay={i * 70}>
                      <div className="group flex items-center gap-4 rounded-[22px] bg-white p-4 ring-1 ring-line transition duration-500 ease-soft hover:-translate-y-1 hover:shadow-soft hover:ring-gold-500/60">
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-champagne text-gold-800 transition-transform duration-500 ease-soft group-hover:scale-105">
                          <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                        </span>
                        <span className="font-semibold text-ink">{t.title}</span>
                      </div>
                    </Reveal>
                  </li>
                );
              })}
            </ul>
          </div>
        </Container>
      </section>

      {/* How sessions work: call or text. */}
      <section className="py-16 lg:py-24">
        <Container>
          <SessionChoice />
        </Container>
      </section>

      {/* Questions. */}
      <section className="py-16 lg:py-24">
        <Container className="max-w-3xl">
          <SectionHeading eyebrow="Good to know" title="Before you book" />
          <Reveal className="mt-10">
            <FaqList />
          </Reveal>
          <Reveal className="mt-10">
            <AskPanel />
          </Reveal>
        </Container>
      </section>

      <BookingCta title="Ask the cards." />
    </>
  );
}
