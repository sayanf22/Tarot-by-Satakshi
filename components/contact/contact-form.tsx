"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { CircleCheck, MessageCircle } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { describedBy, Field, TextArea, TextInput } from "@/components/ui/field";
import { TurnstileField } from "@/components/ui/turnstile-field";
import { api } from "@/lib/api";
import { site } from "@/lib/site";
import { useCooldown } from "@/lib/use-cooldown";
import { contactSchema, type ContactInput } from "@/lib/validation/contact";

// Two modes, chosen in Admin → Account → Settings:
// - WhatsApp (default): the visitor writes a message here and it opens in WhatsApp, ready to
//   send to Satakshi. Nothing is sent to or stored on the website.
// - Inbox: the message is saved in Admin → Messages and emailed to Satakshi.

const whatsappSchema = contactSchema.pick({ name: true, message: true });
type WhatsAppInput = z.infer<typeof whatsappSchema>;

export function whatsappLink(name: string, message: string) {
  const text = `Hello ${site.firstName}, I'm ${name.trim()}.\n\n${message.trim()}`;
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`;
}

function WhatsAppForm() {
  const [opened, setOpened] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WhatsAppInput>({
    resolver: zodResolver(whatsappSchema),
    defaultValues: { name: "", message: "" },
    mode: "onTouched",
  });

  function onSubmit(v: WhatsAppInput) {
    const url = whatsappLink(v.name, v.message);
    // A new tab keeps the site open on computers; phones hand it to the WhatsApp app.
    // ("noopener" would make window.open return null even when it worked, so cut the link by hand.)
    const tab = window.open(url, "_blank");
    if (tab) tab.opener = null;
    else window.location.assign(url);
    setOpened(url);
  }

  return (
    <div aria-live="polite">
      <h2 className="text-3xl">Send a message</h2>
      <p className="mt-2 mb-8 text-ink-muted">
        Write your message here. It opens in WhatsApp, ready to send to {site.firstName}.
      </p>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="space-y-6">
        <Field id="c-name" label="Name" error={errors.name?.message}>
          <TextInput
            id="c-name"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describedBy("c-name", errors.name?.message)}
            {...register("name")}
          />
        </Field>
        <Field id="c-message" label="Message" error={errors.message?.message}>
          <TextArea
            id="c-message"
            rows={5}
            maxLength={2000}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={describedBy("c-message", errors.message?.message)}
            {...register("message")}
          />
        </Field>
        <Button type="submit" className="w-full sm:w-auto">
          <MessageCircle className="size-4" aria-hidden="true" />
          Continue on WhatsApp
        </Button>
        {opened ? (
          <p className="text-sm text-ink-muted">
            WhatsApp didn&apos;t open?{" "}
            <a
              href={opened}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-gold-800 underline"
            >
              Open it here
            </a>{" "}
            or call{" "}
            <a href={site.phone.href} className="font-semibold text-gold-800 underline">
              {site.phone.display}
            </a>
            .
          </p>
        ) : (
          <p className="text-sm text-ink-muted">
            Nothing is stored on this website. Press send in WhatsApp to deliver it.
          </p>
        )}
      </form>
    </div>
  );
}

type Status = "idle" | "sent" | "error";

/** Inbox mode: posts to /api/contact (saved in Admin → Messages and emailed to Satakshi). */
function InboxForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [token, setToken] = useState<string | null>(null);
  const turnstile = useRef<TurnstileInstance | undefined>(undefined);
  // A short pause after each attempt (the Worker also limits to 5 a minute per visitor).
  const cooldown = useCooldown("contact");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", phone: "", message: "" },
    mode: "onTouched",
  });

  async function onSubmit(values: ContactInput) {
    if (cooldown.active) return;
    setStatus("idle");
    cooldown.start(20);
    const r = await api("/api/contact", { method: "POST", json: { ...values, turnstileToken: token } });
    // Each Turnstile token works once.
    turnstile.current?.reset();
    setToken(null);
    if (r.ok) {
      reset();
      setStatus("sent");
    } else setStatus("error");
  }

  const sentView = (
    <div aria-live="polite" className="flex flex-col items-center py-12 text-center">
      <CircleCheck className="size-10 text-gold-700" strokeWidth={1.5} aria-hidden="true" />
      <h2 className="mt-5 text-3xl">Message sent</h2>
      <p className="mt-3 text-ink-muted">Thank you. {site.firstName} will get back to you.</p>
      <Button variant="outline" className="mt-8" onClick={() => setStatus("idle")}>
        Send another
      </Button>
    </div>
  );

  return status === "sent" ? (
    sentView
  ) : (
    <div aria-live="polite">
      <h2 className="text-3xl">Send a message</h2>
      <p className="mt-2 mb-8 text-ink-muted">{site.firstName} will reply by email or phone.</p>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="space-y-6">
        <Field id="c-name" label="Name" error={errors.name?.message}>
          <TextInput
            id="c-name"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describedBy("c-name", errors.name?.message)}
            {...register("name")}
          />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="c-email" label="Email" error={errors.email?.message}>
            <TextInput
              id="c-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={describedBy("c-email", errors.email?.message)}
              {...register("email")}
            />
          </Field>
          <Field id="c-phone" label="Phone" optional error={errors.phone?.message}>
            <TextInput
              id="c-phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={describedBy("c-phone", errors.phone?.message)}
              {...register("phone")}
            />
          </Field>
        </div>
        <Field id="c-message" label="Message" error={errors.message?.message}>
          <TextArea
            id="c-message"
            rows={5}
            maxLength={2000}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={describedBy("c-message", errors.message?.message)}
            {...register("message")}
          />
        </Field>

        {status === "error" ? (
          <p
            role="alert"
            className="rounded-2xl border border-danger/30 bg-white px-4 py-3 text-sm text-danger"
          >
            Sorry, your message couldn&apos;t be sent right now. Please call{" "}
            <a href={site.phone.href} className="font-semibold underline">
              {site.phone.display}
            </a>{" "}
            or email{" "}
            <a href={`mailto:${site.email}`} className="font-semibold break-all underline">
              {site.email}
            </a>
            .
          </p>
        ) : null}

        <TurnstileField ref={turnstile} action="contact" onToken={setToken} />

        <Button
          type="submit"
          disabled={isSubmitting || !token || cooldown.active}
          className="w-full sm:w-auto"
        >
          {isSubmitting ? "Sending…" : cooldown.active ? `Wait ${cooldown.secondsLeft}s` : "Send message"}
        </Button>
      </form>
    </div>
  );
}

/** Shows the WhatsApp form unless the admin has turned the website inbox on. */
export function ContactForm() {
  // WhatsApp is the default, so it shows at once; the inbox form appears only if switched on.
  const [inbox, setInbox] = useState(false);
  useEffect(() => {
    void api<{ contactInbox?: boolean }>("/api/config").then((r) => {
      if (r.ok && r.data.contactInbox) setInbox(true);
    });
  }, []);
  return inbox ? <InboxForm /> : <WhatsAppForm />;
}
