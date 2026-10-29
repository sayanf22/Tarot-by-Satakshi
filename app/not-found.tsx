import { TarotArt } from "@/components/art/tarot-art";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Ornament } from "@/components/ui/ornament";

export default function NotFound() {
  return (
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
  );
}
