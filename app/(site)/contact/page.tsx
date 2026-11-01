import type { Metadata } from "next";
import { ArrowUpRight, Clock, Mail, PhoneCall } from "lucide-react";
import { Mandala } from "@/components/art/mandala";
import { ContactForm } from "@/components/contact/contact-form";
import { PageIntro } from "@/components/layout/page-intro";
import { Container } from "@/components/ui/container";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Questions before you book? Call, email or send Satakshi a message.",
};

const channels = [
  { icon: PhoneCall, label: "Call", value: site.phone.display, href: site.phone.href },
  { icon: Mail, label: "Email", value: site.email, href: `mailto:${site.email}` },
  { icon: Clock, label: "Hours", value: `${site.hours.days}, ${site.hours.time} ${site.hours.timeZone}` },
] as const;

export default function ContactPage() {
  return (
    <>
      <PageIntro
        eyebrow="Contact"
        title="Get in touch"
        description="Questions before you book? Call, email or send a message."
      />
      <Container className="grid gap-12 py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:py-28">
        <ul className="min-w-0 space-y-4">
          {channels.map((c) => {
            const Icon = c.icon;
            const body = (
              <>
                <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-champagne text-gold-800 ring-1 ring-gold-500/40 transition-transform duration-500 ease-soft group-hover:scale-105">
                  <Icon className="size-6" strokeWidth={1.6} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block eyebrow">{c.label}</span>
                  <span className="mt-1 block font-semibold [overflow-wrap:anywhere] text-ink">
                    {c.value}
                  </span>
                </span>
              </>
            );
            return (
              <li key={c.label}>
                {"href" in c ? (
                  <a
                    href={c.href}
                    className="group flex items-center gap-5 rounded-[28px] bg-white p-5 ring-1 ring-line transition duration-500 ease-soft hover:-translate-y-1 hover:shadow-lift hover:ring-gold-500/60"
                  >
                    {body}
                    <ArrowUpRight
                      className="size-5 shrink-0 text-gold-700 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden="true"
                    />
                  </a>
                ) : (
                  <div className="flex items-center gap-5 rounded-[28px] bg-ivory p-5 ring-1 ring-line">
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="relative overflow-hidden rounded-[32px] bg-white shadow-soft ring-1 ring-line">
          <Mandala className="pointer-events-none absolute -top-24 -right-24 size-72 text-gold-500/20" />
          <div className="relative px-6 py-8 sm:px-10 sm:py-10">
            <h2 className="text-3xl">Send a message</h2>
            <p className="mt-2 mb-8 text-ink-muted">{site.firstName} will reply by email or phone.</p>
            <ContactForm />
          </div>
        </div>
      </Container>
    </>
  );
}
