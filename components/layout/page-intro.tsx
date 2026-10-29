import type { ReactNode } from "react";
import { Particles } from "@/components/art/particles";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

// Title panel at the top of inner pages: a rounded ivory card on the white page.
export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
}) {
  return (
    <section className="pt-4 sm:pt-6">
      <Container>
        <div className="relative overflow-hidden rounded-[36px] bg-ivory px-6 py-16 ring-1 ring-line sm:py-20">
          <Particles count={14} seed={9} />
          <SectionHeading
            as="h1"
            eyebrow={eyebrow}
            title={title}
            description={description}
            className="relative"
          />
        </div>
      </Container>
    </section>
  );
}
