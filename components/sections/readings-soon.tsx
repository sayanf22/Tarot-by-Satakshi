import { MessageCircle, PhoneCall } from "lucide-react";
import { TarotArt } from "@/components/art/tarot-art";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { site } from "@/lib/site";

// Shown while no plans are published yet (they are added in the admin).
export function ReadingsSoon() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-[32px] bg-ivory px-6 py-12 text-center ring-1 ring-line sm:px-10">
      <TarotArt icon="cards" className="size-16 text-gold-700" />
      <p className="mt-6 font-display text-[1.7rem] leading-tight text-ink">Readings are being added</p>
      <p className="mt-3 text-ink-muted">
        Online booking opens soon. To book a reading now, call or send a message to {site.firstName}.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a href={site.phone.href} className={buttonClasses({ variant: "outline" })}>
          <PhoneCall className="size-4" strokeWidth={1.9} aria-hidden="true" />
          Call
        </a>
        <ButtonLink href="/contact">
          <MessageCircle className="size-4" strokeWidth={1.9} aria-hidden="true" />
          Message
        </ButtonLink>
      </div>
    </div>
  );
}
