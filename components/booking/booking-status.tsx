"use client";

import { useSearchParams } from "next/navigation";
import { CircleAlert, CircleCheck, Clock, Hourglass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Ornament } from "@/components/ui/ornament";
import { site } from "@/lib/site";

// Phase 7 replaces the ?state= parameter with a server-side check of the payment.
const states = {
  confirmed: {
    icon: CircleCheck,
    title: "Your booking is confirmed",
    text: `A confirmation email is on its way. ${site.firstName} will reach out for your session.`,
    action: { href: "/", label: "Back to home" },
  },
  processing: {
    icon: Hourglass,
    title: "Confirming your payment",
    text: "This usually takes a moment. Please keep this page open.",
    action: null,
  },
  failed: {
    icon: CircleAlert,
    title: "The payment didn't go through",
    text: "Your slot wasn't booked. You can try again.",
    action: { href: "/book", label: "Try again" },
  },
  expired: {
    icon: Clock,
    title: "Your time slot was released",
    text: "The hold ran out before payment finished. Please choose a time again.",
    action: { href: "/book", label: "Choose a time" },
  },
} as const;

type State = keyof typeof states;

export function BookingStatus() {
  const params = useSearchParams();
  const raw = params.get("state");
  const state: State = raw && raw in states ? (raw as State) : "processing";
  const ref = params.get("ref");
  const safeRef = ref && /^[A-Z0-9-]{4,24}$/i.test(ref) ? ref.toUpperCase() : null;
  const { icon: Icon, title, text, action } = states[state];

  return (
    <div className="mx-auto max-w-lg text-center">
      <span className="mx-auto flex size-20 items-center justify-center rounded-full border border-gold-500 bg-ivory">
        <Icon className="size-8 text-gold-700" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h1 className="mt-8 text-[2.2rem] sm:text-5xl">{title}</h1>
      <Ornament className="mt-6" />
      <p className="mt-6 text-lg text-ink-muted">{text}</p>
      {safeRef ? (
        <p className="mt-6 text-sm text-ink-muted">
          Booking reference <span className="font-semibold text-ink tabular">{safeRef}</span>
        </p>
      ) : null}
      {action ? (
        <ButtonLink href={action.href} className="mt-10">
          {action.label}
        </ButtonLink>
      ) : null}
      <p className="mt-10 text-sm text-ink-muted">
        Questions? Call{" "}
        <a href={site.phone.href} className="font-semibold text-gold-800 hover:underline">
          {site.phone.display}
        </a>
      </p>
    </div>
  );
}
