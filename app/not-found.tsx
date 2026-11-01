import { TarotArt } from "@/components/art/tarot-art";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Ornament } from "@/components/ui/ornament";

// Rendered by the root layout, so it adds the site header and footer itself.
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <Container className="flex flex-col items-center py-24 text-center lg:py-32">
          <TarotArt icon="moon" className="size-28 text-gold-700" />
          <p className="mt-8 eyebrow">Page not found</p>
          <h1 className="mt-4 text-[2.4rem] sm:text-5xl">This page has drifted away.</h1>
          <Ornament className="mt-6" />
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <ButtonLink href="/">Back to home</ButtonLink>
            <ButtonLink href="/book" variant="outline">
              Book a session
            </ButtonLink>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
