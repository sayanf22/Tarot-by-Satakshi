"use client";

import { CalendarDays, Clock, Gauge, Images, Inbox, Layers, LogOut, Mail, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { AdminAccount } from "./account";
import { AdminBookings } from "./bookings";
import { AdminHours } from "./hours";
import { AdminImages } from "./images";
import { AdminMessages } from "./messages";
import { AdminOverview } from "./overview";
import { AdminPlans } from "./plans";
import { Notice, SignOutContext } from "./shared";

const tabs = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "bookings", label: "Bookings", icon: CalendarDays },
  { id: "plans", label: "Plans", icon: Layers },
  { id: "hours", label: "Hours", icon: Clock },
  { id: "messages", label: "Messages", icon: Inbox },
  { id: "images", label: "Images", icon: Images },
  { id: "account", label: "Account", icon: UserRound },
] as const;
type Tab = (typeof tabs)[number]["id"];

type Auth = "checking" | "off" | "out" | "in";

function SignIn({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api("/api/admin/login/start", { method: "POST", json: { email: email.trim() } });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setStep("code");
    setCode("");
    setResendIn(45);
    // Move focus to the code box for keyboard and screen-reader users.
    requestAnimationFrame(() => document.getElementById("a-code")?.focus());
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api("/api/admin/login/verify", {
      method: "POST",
      json: { email: email.trim(), code: code.replace(/\D/g, "") },
    });
    setBusy(false);
    if (r.ok) onDone();
    else {
      setError(r.error);
      setCode("");
    }
  }

  return (
    <div className="flex min-h-dvh items-start justify-center px-5 py-12 sm:items-center">
      <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-soft ring-1 ring-line sm:p-8">
        <div className="text-center">
          <Wordmark className="items-center" />
          <h1 className="mt-6 font-display text-3xl">Admin sign-in</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {step === "email"
              ? "We'll email you a one-time code. No password needed."
              : `If ${email.trim()} is an admin address, a 6-digit code is on its way.`}
          </p>
        </div>
        {step === "email" ? (
          <form onSubmit={sendCode} className="mt-6 space-y-5">
            <Field id="a-email" label="Email">
              <TextInput
                id="a-email"
                type="email"
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            {error ? <Notice tone="error">{error}</Notice> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              <Mail className="size-4" aria-hidden="true" />
              {busy ? "Sending…" : "Email me a code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-6 space-y-5">
            <Field id="a-code" label="Code from the email" hint="6 digits. It works once, for 10 minutes.">
              <TextInput
                id="a-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                aria-describedby="a-code-hint"
                className="text-center text-2xl tracking-[0.4em] tabular"
                required
              />
            </Field>
            {error ? <Notice tone="error">{error}</Notice> : null}
            <Button type="submit" className="w-full" disabled={busy || code.replace(/\D/g, "").length !== 6}>
              {busy ? "Checking…" : "Sign in"}
            </Button>
            <div className="flex items-center justify-between gap-3 text-sm">
              <button
                type="button"
                className="font-semibold text-gold-800 hover:underline"
                onClick={() => setStep("email")}
              >
                Use another email
              </button>
              <button
                type="button"
                className="font-semibold text-gold-800 hover:underline disabled:text-ink-muted disabled:no-underline"
                disabled={resendIn > 0 || busy}
                onClick={() => void sendCode()}
              >
                {resendIn > 0 ? `Send again in ${resendIn}s` : "Send a new code"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
export function AdminApp() {
  const [auth, setAuth] = useState<Auth>("checking");
  // The first render is the "Loading…" screen, so reading the hash here can't cause a hydration mismatch.
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "overview";
    const fromHash = window.location.hash.slice(1);
    return tabs.find((t) => t.id === fromHash)?.id ?? "overview";
  });

  // Is sign-in set up, and is there a valid session already?
  useEffect(() => {
    void api<{ configured: boolean }>("/api/admin/status")
      .then((status) => (status.ok && !status.data.configured ? null : api("/api/admin/me")))
      .then((me) => setAuth(me === null ? "off" : me.ok ? "in" : "out"));
  }, []);

  function go(next: Tab) {
    setTab(next);
    history.replaceState(null, "", `#${next}`);
    window.scrollTo({ top: 0 });
    // On phones, keep the chosen tab fully in view in the scrolling strip.
    requestAnimationFrame(() =>
      document
        .querySelector(`header nav [data-tab="${next}"]`)
        ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }),
    );
  }

  async function signOut(everywhere = false) {
    if (everywhere && !confirm("Sign out on every device, including this one?")) return;
    await api(`/api/admin/logout${everywhere ? "?everywhere=1" : ""}`, { method: "POST", json: {} });
    setAuth("out");
  }

  if (auth === "checking") return <p className="py-24 text-center text-ink-muted">Loading…</p>;
  if (auth === "off")
    return (
      <div className="mx-auto max-w-md px-5 pt-16">
        <Notice>
          Admin sign-in isn&apos;t set up yet. Sign-in codes are sent by email, so the Worker needs the
          RESEND_API_KEY secret and an EMAIL_FROM sender address.
        </Notice>
      </div>
    );
  if (auth === "out") return <SignIn onDone={() => setAuth("in")} />;

  return (
    <SignOutContext.Provider value={() => setAuth("out")}>
      {/* Phones and tablets: a top bar with the tabs below it, both sticky. */}
      <header className="sticky top-0 z-30 border-b border-line bg-ivory/95 lg:hidden">
        <div className="flex items-center justify-between px-4 pt-3 pb-2 sm:px-6">
          <div className="flex items-end gap-2.5">
            <Wordmark className="items-start" />
            <span className="mb-1 rounded-full bg-champagne px-2 py-0.5 text-[0.6rem] font-bold tracking-[0.18em] text-gold-800 uppercase">
              Admin
            </span>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex size-10 items-center justify-center rounded-full text-ink ring-1 ring-line hover:bg-champagne"
            aria-label="Sign out"
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        </div>
        <nav
          aria-label="Admin sections"
          className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-3 sm:px-6"
        >
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => go(id)}
              data-tab={id}
              aria-current={tab === id ? "page" : undefined}
              className={cn(
                "flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors duration-300",
                tab === id ? "bg-gold-foil text-ink shadow-gold" : "bg-white text-ink ring-1 ring-line",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto flex w-full max-w-[1240px] gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        {/* Desktop: a fixed sidebar. */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-10">
            <Wordmark className="items-start" />
            <p className="mt-2 text-xs font-bold tracking-[0.2em] text-gold-800 uppercase">Admin</p>
            <nav aria-label="Admin sections" className="mt-6 flex flex-col gap-1">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => go(id)}
                  aria-current={tab === id ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-full px-4 py-2.5 text-left text-sm font-semibold transition-colors duration-300",
                    tab === id ? "bg-gold-foil text-ink shadow-gold" : "text-ink hover:bg-champagne",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-8 flex items-center gap-2 px-4 text-sm font-semibold text-ink-muted hover:text-ink"
            >
              <LogOut className="size-4" aria-hidden="true" /> Sign out
            </button>
          </div>
        </aside>

        <main id="main" className="min-w-0 flex-1 animate-rise space-y-6" key={tab}>
          {tab === "overview" ? <AdminOverview onOpen={go} /> : null}
          {tab === "bookings" ? <AdminBookings /> : null}
          {tab === "plans" ? <AdminPlans /> : null}
          {tab === "hours" ? <AdminHours /> : null}
          {tab === "messages" ? <AdminMessages /> : null}
          {tab === "images" ? <AdminImages /> : null}
          {tab === "account" ? <AdminAccount onSignOutAll={() => void signOut(true)} /> : null}
        </main>
      </div>
    </SignOutContext.Provider>
  );
}
