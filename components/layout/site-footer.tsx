import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Clock, Layers, Mail, MessageCircle, PhoneCall, type LucideIcon } from "lucide-react";
import { Mandala } from "@/components/art/mandala";
import { Wordmark } from "@/components/brand/wordmark";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { navigation, site } from "@/lib/site";

// Read once at build time; the site is rebuilt on every deploy.
const year = new Date().getFullYear();

// Black footer: a large brand line with the main action, then four columns (brand,
// links, contact, hours) and a quiet bottom row.
// Text: white 18:1, mist 14:1, gold-300 11:1 on black.

function ColumnTitle({ children }: { children: ReactNode }) {
  return <p className="text-xs font-bold tracking-[0.24em] text-gold-300 uppercase">{children}</p>;
}

/** A footer link whose gold underline draws from the left on hover or keyboard focus. */
function LineLink({ href, icon: Icon, children }: { href: string; icon?: LucideIcon; children: ReactNode }) {
  const className =
    "group/link inline-flex items-center gap-3 py-1 text-[1.02rem] font-semibold text-white transition-colors duration-300 hover:text-gold-300 focus-visible:text-gold-300";
  const body = (
    <>
      {Icon ? (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ring-white/20 transition-colors duration-300 group-hover/link:ring-gold-300/70">
          <Icon className="size-4 text-gold-300" strokeWidth={1.9} aria-hidden="true" />
        </span>
      ) : null}
      <span className="relative">
        {children}
        <span
          aria-hidden="true"
          className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-gold-300 transition-transform duration-500 ease-soft group-hover/link:scale-x-100 group-focus-visible/link:scale-x-100"
        />
      </span>
    </>
  );
  // Phone and email links are plain anchors; pages use Next's Link.
  return href.startsWith("/") ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <a href={href} className={className}>
      {body}
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className="grain-dark relative mt-20 overflow-hidden rounded-t-[48px] bg-black text-white">
      <Mandala className="spin-slow pointer-events-none absolute -top-56 -right-56 w-[40rem] text-gold-500/15" />
      <Container className="relative">
        {/* Brand line and the main action. */}
        <div className="flex flex-col items-start gap-10 border-b border-white/10 pt-20 pb-16 lg:flex-row lg:items-end lg:justify-between lg:pt-24">
          <div>
            <ColumnTitle>{site.offering}</ColumnTitle>
            <p className="mt-5 font-display text-[2.6rem] leading-[1.04] text-white sm:text-[3.4rem] lg:text-[4.2rem]">
              Clarity, one card
              <br />
              at a time.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 lg:pb-2">
            <ButtonLink href="/book">
              Book a session
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="/contact" variant="ghost-light">
              Ask a question
            </ButtonLink>
          </div>
        </div>

        {/* Columns. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 py-16 lg:grid-cols-[1.5fr_1fr_1.2fr_1.2fr] lg:gap-10 lg:py-20">
          <div className="col-span-2 flex flex-col items-start lg:col-span-1">
            <Wordmark tone="light" className="items-start" />
            <p className="mt-6 max-w-xs text-mist">
              Tarot and astrology readings with {site.owner}, on a call or over text.
            </p>
          </div>

          <nav aria-label="Footer">
            <ColumnTitle>Explore</ColumnTitle>
            <ul className="mt-6 space-y-3">
              {navigation.map((item) => (
                <li key={item.href}>
                  <LineLink href={item.href}>{item.label}</LineLink>
                </li>
              ))}
              <li>
                <LineLink href="/book">Book a session</LineLink>
              </li>
            </ul>
          </nav>

          <div>
            <ColumnTitle>Get in touch</ColumnTitle>
            <ul className="mt-6 space-y-3">
              <li>
                <LineLink href={site.phone.href} icon={PhoneCall}>
                  Call
                </LineLink>
              </li>
              <li>
                <LineLink href={`mailto:${site.email}`} icon={Mail}>
                  Email
                </LineLink>
              </li>
              <li>
                <LineLink href="/contact" icon={MessageCircle}>
                  Message
                </LineLink>
              </li>
            </ul>
          </div>

          <div className="col-span-2 lg:col-span-1">
            <ColumnTitle>Hours</ColumnTitle>
            <ul className="mt-6 space-y-4">
              <li className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ring-white/20">
                  <Clock className="size-4 text-gold-300" strokeWidth={1.9} aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold text-white">{site.hours.days}</span>
                  <span className="block text-mist">
                    {site.hours.time} {site.hours.timeZone}
                  </span>
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ring-white/20">
                  <Layers className="size-4 text-gold-300" strokeWidth={1.9} aria-hidden="true" />
                </span>
                <span className="font-semibold text-white">Call or text sessions</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 border-t border-white/10 py-8 text-sm text-mist sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {site.name}. All rights reserved.
          </p>
          <p>
            Made by <strong className="font-bold text-white">WhyCreatives</strong>
          </p>
        </div>
      </Container>
    </footer>
  );
}
