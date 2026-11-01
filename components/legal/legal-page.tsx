import Link from "next/link";
import type { ReactNode } from "react";
import { PageIntro } from "@/components/layout/page-intro";
import { Container } from "@/components/ui/container";

// The date printed on every policy page. Change it whenever the wording changes.
export const policyUpdated = "2 November 2026";

export type LegalSection = { heading: string; body: ReactNode };

/** A bulleted list inside a policy section. */
export function Bullets({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-6 marker:text-gold-700">{children}</ul>;
}

/** A link inside policy text: bold, gold and underlined so it stands out from the body. */
export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-gold-800 underline underline-offset-4">
      {children}
    </Link>
  );
}

// One layout for every policy page: a title panel, then the text in a single white card.
export function LegalPage({
  title,
  description,
  sections,
}: {
  title: string;
  description: string;
  sections: LegalSection[];
}) {
  return (
    <>
      <PageIntro eyebrow="Policy" title={title} description={description} />
      <Container className="py-16 lg:py-20">
        <article className="mx-auto max-w-3xl rounded-[32px] bg-white px-6 py-10 shadow-soft ring-1 ring-line sm:px-12 sm:py-14">
          <p className="text-sm font-semibold text-gold-800">Last updated {policyUpdated}</p>
          <div className="mt-8 space-y-10">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-2xl sm:text-3xl">{section.heading}</h2>
                <div className="mt-4 space-y-4 text-[1.02rem] leading-relaxed text-ink">{section.body}</div>
              </section>
            ))}
          </div>
        </article>
        <p className="mx-auto mt-10 max-w-3xl text-center text-ink">
          Questions about this page? <TextLink href="/contact">Contact us</TextLink>.
        </p>
      </Container>
    </>
  );
}
