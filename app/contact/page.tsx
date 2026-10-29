import type { Metadata } from "next";
import { Clock, Mail, Phone } from "lucide-react";
import { ContactForm } from "@/components/contact/contact-form";
import { PageIntro } from "@/components/layout/page-intro";
import { Container } from "@/components/ui/container";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Questions before you book? Call, email or send Satakshi a message.",
};

const channels = [
  { icon: Phone, label: "Call", value: site.phone.display, href: site.phone.href },
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
        <ul className="space-y-4">
          {channels.map((c) => {
            const Icon = c.icon;
            const body = (
              <>
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-ivory">
                  <Icon className="size-5 text-gold-700" strokeWidth={1.6} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block eyebrow">{c.label}</span>
                  <span className="mt-1 block font-semibold break-words text-ink">{c.value}</span>
                </span>
              </>
            );
            return (
              <li key={c.label}>
                {"href" in c ? (
                  <a
                    href={c.href}
                    className="flex items-center gap-5 rounded-3xl border border-line bg-white p-5 transition duration-300 hover:-translate-y-0.5 hover:border-gold-500/60 hover:shadow-soft"
                  >
                    {body}
                  </a>
                ) : (
                  <div className="flex items-center gap-5 rounded-3xl border border-line bg-white p-5">
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="rounded-[32px] bg-white shadow-soft ring-1 ring-line">
          <div className="px-6 py-8 sm:px-10 sm:py-10">
            <h2 className="text-3xl">Send a message</h2>
            <p className="mt-2 mb-8 text-ink-muted">{site.firstName} will reply by email or phone.</p>
            <ContactForm />
          </div>
        </div>
      </Container>
    </>
  );
}
