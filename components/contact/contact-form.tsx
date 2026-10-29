"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { describedBy, Field, TextArea, TextInput } from "@/components/ui/field";
import { site } from "@/lib/site";
import { contactSchema, type ContactInput } from "@/lib/validation/contact";

type Status = "idle" | "sent" | "error";

// Posts to /api/contact. The Worker route (with Turnstile and email to Satakshi)
// is built in phase 4; until then a submit shows the error state with her contact details.
export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
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
    setStatus("idle");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error(String(res.status));
      reset();
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div aria-live="polite">
      {status === "sent" ? (
        <div className="flex flex-col items-center py-12 text-center">
          <CircleCheck className="size-10 text-gold-700" strokeWidth={1.5} aria-hidden="true" />
          <h2 className="mt-5 text-3xl">Message sent</h2>
          <p className="mt-3 text-ink-muted">Thank you. {site.firstName} will get back to you.</p>
          <Button variant="outline" className="mt-8" onClick={() => setStatus("idle")}>
            Send another
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
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

          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? "Sending…" : "Send message"}
          </Button>
        </form>
      )}
    </div>
  );
}
