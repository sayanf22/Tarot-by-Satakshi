"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, Clock, Hourglass, RotateCcw } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Ornament } from "@/components/ui/ornament";
import { api } from "@/lib/api";
import { site } from "@/lib/site";

// The status always comes from the server (/api/bookings/:ref), never from the URL.
// While a payment is still settling, the page checks again every few seconds.
const states = {
  confirmed: {
    icon: CircleCheck,
    title: "Your booking is confirmed",
    text: `Thank you. ${site.firstName} will reach out for your session.`,
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
    text: "Your session isn't booked yet. You can try again.",
    action: { href: "/book", label: "Try again" },
  },
  expired: {
    icon: Clock,
    title: "Your time slot was released",
    text: "The hold ran out before payment finished. Please choose a time again.",
    action: { href: "/book", label: "Choose a time" },
  },
  refunded: {
    icon: RotateCcw,
    title: "Your payment is being refunded",
    text: "Someone else booked that time just before your payment finished, so the full amount is on its way back to you.",
    action: { href: "/book", label: "Choose another time" },
  },
  unknown: {
    icon: CircleAlert,
    title: "We couldn't find that booking",
    text: "Please check the link, or get in touch and we'll help.",
    action: { href: "/contact", label: "Contact us" },
  },
} as const;

type State = keyof typeof states;
type Status = { status: string; service: string; startAt: number; format: string };

const POLL_MS = 3000;
const POLL_LIMIT = 40; // about two minutes

function toState(s: string): State {
  if (s === "confirmed") return "confirmed";
  if (s === "held") return "processing";
  if (s === "failed") return "failed";
  if (s === "refunded") return "refunded";
  if (s === "expired" || s === "cancelled") return "expired";
  return "unknown";
}

export function BookingStatus() {
  const params = useSearchParams();
  const raw = params.get("ref") ?? "";
  const ref = /^TS-[A-Z0-9]{8}$/i.test(raw) ? raw.toUpperCase() : null;
  const [state, setState] = useState<State>(ref ? "processing" : "unknown");
  const [info, setInfo] = useState<Status | null>(null);

  useEffect(() => {
    if (!ref) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    async function check() {
      const r = await api<Status>(`/api/bookings/${ref}`);
      if (stopped) return;
      if (r.ok) {
        setInfo(r.data);
        const next = toState(r.data.status);
        setState(next);
        if (next !== "processing") return;
      } else if (r.status === 404) {
        setState("unknown");
        return;
      }
      if (++tries < POLL_LIMIT) timer = setTimeout(check, POLL_MS);
    }
    void check();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [ref]);

  const { icon: Icon, title, text, action } = states[state];
  const when =
    info && state === "confirmed"
      ? new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "numeric",
          minute: "2-digit",
        }).format(info.startAt)
      : null;

  return (
    <div className="mx-auto max-w-lg text-center" aria-live="polite">
      <span className="mx-auto flex size-20 items-center justify-center rounded-full border border-gold-500 bg-ivory">
        <Icon className="size-8 text-gold-700" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h1 className="mt-8 text-[2.2rem] sm:text-5xl">{title}</h1>
      <Ornament className="mt-6" />
      <p className="mt-6 text-lg text-ink-muted">{text}</p>
      {when && info ? (
        <p className="mt-4 font-semibold text-ink">
          {info.service}, {when} IST
        </p>
      ) : null}
      {ref ? (
        <p className="mt-6 text-sm text-ink-muted">
          Booking reference <span className="font-semibold text-ink tabular">{ref}</span>
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
