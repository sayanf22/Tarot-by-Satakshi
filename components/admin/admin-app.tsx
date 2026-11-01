"use client";

import { CalendarDays, Gauge, Images, Inbox, Layers, LogOut, Clock } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
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
] as const;
type Tab = (typeof tabs)[number]["id"];

type Auth = "checking" | "off" | "out" | "in";

function SignIn({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api("/api/admin/login", {
      method: "POST",
      json: { password, code: code.replace(/\s/g, "") },
    });
    setBusy(false);
    setCode("");
    if (r.ok) onDone();
    else setError(r.error);
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-16 w-[calc(100%-2.5rem)] max-w-sm space-y-5 rounded-[28px] bg-white p-7 shadow-soft ring-1 ring-line"
    >
      <div className="text-center">
        <Wordmark />
        <h1 className="mt-6 font-display text-3xl">Admin sign-in</h1>
      </div>
      <Field id="a-pass" label="Password">
        <TextInput
          id="a-pass"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>
      <Field id="a-code" label="Code from your authenticator app" hint="6 digits, changes every 30 seconds.">
        <TextInput
          id="a-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-describedby="a-code-hint"
          required
        />
      </Field>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
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
  }

  async function signOut(everywhere = false) {
    await api(`/api/admin/logout${everywhere ? "?everywhere=1" : ""}`, { method: "POST", json: {} });
    setAuth("out");
  }

  if (auth === "checking") return <p className="py-24 text-center text-ink-muted">Loading…</p>;
  if (auth === "off")
    return (
      <div className="mx-auto mt-16 max-w-md">
        <Notice>
          Admin sign-in isn&apos;t set up yet. Add the ADMIN_PASSWORD and ADMIN_TOTP_SECRET secrets to the
          Worker.
        </Notice>
      </div>
    );
  if (auth === "out") return <SignIn onDone={() => setAuth("in")} />;

  return (
    <SignOutContext.Provider value={() => setAuth("out")}>
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6 lg:flex-row lg:px-8 lg:py-10">
        <aside className="lg:sticky lg:top-8 lg:w-56 lg:shrink-0 lg:self-start">
          <div className="flex items-center justify-between lg:block">
            <Wordmark className="items-start" />
            <p className="hidden text-xs font-bold tracking-[0.2em] text-gold-800 uppercase lg:mt-2 lg:block">
              Admin
            </p>
          </div>
          <nav
            aria-label="Admin"
            className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:px-0"
          >
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => go(id)}
                aria-current={tab === id ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors",
                  tab === id ? "bg-gold-foil text-ink shadow-gold" : "text-ink hover:bg-champagne",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-6 hidden space-y-2 lg:block">
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex items-center gap-2 text-sm font-semibold text-ink-muted hover:text-ink"
            >
              <LogOut className="size-4" aria-hidden="true" /> Sign out
            </button>
            <button
              type="button"
              onClick={() => void signOut(true)}
              className="text-xs text-ink-muted underline hover:text-ink"
            >
              Sign out on all devices
            </button>
          </div>
        </aside>

        <main id="main" className="min-w-0 flex-1 space-y-6">
          {tab === "overview" ? <AdminOverview onOpen={go} /> : null}
          {tab === "bookings" ? <AdminBookings /> : null}
          {tab === "plans" ? <AdminPlans /> : null}
          {tab === "hours" ? <AdminHours /> : null}
          {tab === "messages" ? <AdminMessages /> : null}
          {tab === "images" ? <AdminImages /> : null}
          <div className="flex gap-4 lg:hidden">
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </main>
      </div>
    </SignOutContext.Provider>
  );
}
