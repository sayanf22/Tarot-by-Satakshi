import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Diamond } from "@/components/ui/ornament";
import { navigation, site } from "@/lib/site";

// Read once at build time; the site is rebuilt on every deploy.
const year = new Date().getFullYear();

const linkClass = "text-white transition-colors duration-300 hover:text-gold-300 focus-visible:text-gold-300";

// Clean black footer like the reference: brand, links and one action, then a quiet bottom row.
// Text: white 18:1, mist 14:1, gold-300 11:1 on black.
export function SiteFooter() {
  return (
    <footer className="grain-dark relative mt-16 overflow-hidden rounded-t-[40px] bg-black text-white">
      <Container className="relative">
        <div className="flex flex-col items-center gap-8 py-14 text-center lg:flex-row lg:justify-between lg:text-left">
          <Wordmark tone="light" />
          <nav aria-label="Footer">
            <ul className="flex flex-wrap justify-center gap-x-9 gap-y-3 text-[0.95rem] font-semibold">
              {navigation.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <ButtonLink href="/book">Book a session</ButtonLink>
        </div>

        <div className="flex flex-col items-center gap-x-8 gap-y-3 border-t border-white/10 py-8 text-[0.95rem] sm:flex-row sm:flex-wrap sm:justify-center">
          <a href={site.phone.href} className={linkClass}>
            {site.phone.display}
          </a>
          <Diamond className="hidden sm:inline-block" />
          <a href={`mailto:${site.email}`} className={`${linkClass} break-all`}>
            {site.email}
          </a>
          <Diamond className="hidden sm:inline-block" />
          <span className="text-mist">
            {site.hours.daysShort}, {site.hours.time} {site.hours.timeZone}
          </span>
        </div>

        <div className="flex flex-col items-center gap-2 border-t border-white/10 py-6 text-center text-sm text-mist sm:flex-row sm:justify-between sm:text-left">
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
