"use client";

import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { Badge, Notice, PageTitle, Panel, useAdminApi, when } from "./shared";

type Account = {
  loginId: string;
  passwordChangedAt: number | null;
  sessionExpires: number;
  activeSessions: number;
  minPassword: number;
  recentSignIns: { at: number; ok: number }[];
};

/** Rough strength meter: length and variety. Only a hint; the server enforces the rules. */
function strength(p: string) {
  let score = 0;
  if (p.length >= 12) score++;
  if (p.length >= 16) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/\d/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p) || p.includes(" ")) score++;
  return Math.min(score, 4);
}
const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];

export function AdminAccount({ onSignOutAll }: { onSignOutAll: () => void }) {
  const adminApi = useAdminApi();
  const [acc, setAcc] = useState<Account | null>(null);
  const [form, setForm] = useState({ current: "", next: "", confirm: "", code: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await adminApi<Account>("/account");
    if (r.ok) setAcc(r.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => void load(), [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (form.next !== form.confirm) return setMsg({ tone: "error", text: "The new passwords don't match." });
    if (acc && form.next.length < acc.minPassword)
      return setMsg({ tone: "error", text: `Use at least ${acc.minPassword} characters.` });
    setBusy(true);
    const r = await adminApi("/password", {
      method: "POST",
      json: { current: form.current, next: form.next, code: form.code.replace(/\s/g, "") },
    });
    setBusy(false);
    setForm({ current: "", next: "", confirm: "", code: "" });
    if (r.ok) {
      setMsg({ tone: "ok", text: "Password changed. Every other device has been signed out." });
      await load();
    } else setMsg({ tone: "error", text: r.error });
  }

  const s = strength(form.next);

  return (
    <>
      <PageTitle title="Account" />
      <Panel title="Sign-in details">
        {acc ? (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
            <dt className="text-sm text-ink-muted">Login ID</dt>
            <dd className="font-semibold break-all text-ink">{acc.loginId}</dd>
            <dt className="text-sm text-ink-muted">Password</dt>
            <dd className="text-ink">
              {acc.passwordChangedAt
                ? `Changed ${when(acc.passwordChangedAt)}`
                : "The first password (not changed yet)"}
            </dd>
            <dt className="text-sm text-ink-muted">Second step</dt>
            <dd className="flex items-center gap-2 text-ink">
              <ShieldCheck className="size-4 text-gold-700" aria-hidden="true" /> Authenticator app code
            </dd>
            <dt className="text-sm text-ink-muted">This session ends</dt>
            <dd className="text-ink">{when(acc.sessionExpires)}</dd>
            <dt className="text-sm text-ink-muted">Signed-in devices</dt>
            <dd className="flex flex-wrap items-center gap-3 text-ink">
              {acc.activeSessions}
              <Button size="sm" variant="outline" onClick={onSignOutAll}>
                Sign out everywhere
              </Button>
            </dd>
          </dl>
        ) : (
          <p className="text-ink-muted">Loading…</p>
        )}
      </Panel>

      <Panel title="Change password">
        <form onSubmit={submit} className="grid max-w-xl gap-5">
          <Field id="pw-current" label="Current password">
            <TextInput
              id="pw-current"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={form.current}
              onChange={(e) => setForm({ ...form, current: e.target.value })}
              required
            />
          </Field>
          <Field
            id="pw-next"
            label="New password"
            hint={`At least ${acc?.minPassword ?? 12} characters. A few unrelated words with numbers works well.`}
          >
            <TextInput
              id="pw-next"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={form.next}
              onChange={(e) => setForm({ ...form, next: e.target.value })}
              aria-describedby="pw-next-hint pw-strength"
              required
            />
          </Field>
          {form.next ? (
            <div id="pw-strength" className="-mt-2 flex items-center gap-3" aria-live="polite">
              <div className="flex flex-1 gap-1" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${i < s ? (s >= 3 ? "bg-[#3c8a55]" : "bg-gold-500") : "bg-line"}`}
                  />
                ))}
              </div>
              <span className="text-xs font-semibold text-ink-muted">{labels[s]}</span>
            </div>
          ) : null}
          <Field id="pw-confirm" label="New password again">
            <TextInput
              id="pw-confirm"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              required
            />
          </Field>
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="-mt-1 flex w-fit items-center gap-2 text-sm font-semibold text-gold-800 hover:underline"
          >
            {show ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
            {show ? "Hide passwords" : "Show passwords"}
          </button>
          <Field id="pw-code" label="Code from your authenticator app">
            <TextInput
              id="pw-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
            />
          </Field>
          {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
          <Button type="submit" disabled={busy} className="w-full sm:w-fit">
            <KeyRound className="size-4" aria-hidden="true" />
            {busy ? "Changing…" : "Change password"}
          </Button>
        </form>
      </Panel>

      <Panel title="Recent sign-in attempts">
        {acc?.recentSignIns.length ? (
          <ul className="divide-y divide-line text-sm">
            {acc.recentSignIns.map((a) => (
              <li key={a.at} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-ink tabular">{when(a.at)}</span>
                <Badge tone={a.ok ? "green" : "red"}>{a.ok ? "Signed in" : "Failed"}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">None yet.</p>
        )}
        <p className="mt-4 text-sm text-ink-muted">
          Forgot the password? In the Cloudflare dashboard, open the tarot-by-satakshi Worker, then Settings,
          Variables and Secrets, and set a new ADMIN_PASSWORD. That becomes the password straight away.
        </p>
      </Panel>
    </>
  );
}
