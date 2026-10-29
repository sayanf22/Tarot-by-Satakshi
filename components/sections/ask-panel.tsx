import { MessageCircle, PhoneCall } from "lucide-react";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { site } from "@/lib/site";

// "Something else on your mind?" with a Call and a Message button.
// The number itself is not printed here; the Call button dials it.
export function AskPanel() {
  return (
    <div className="flex flex-col items-center gap-5 rounded-[28px] bg-ivory p-6 text-center ring-1 ring-line sm:flex-row sm:justify-between sm:p-7 sm:text-left">
      <p className="font-display text-[1.45rem] leading-tight text-ink">Something else on your mind?</p>
      <div className="flex flex-wrap justify-center gap-3">
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
