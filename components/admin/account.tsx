"use client";

import { Mail, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/cn";
import { useCooldown } from "@/lib/use-cooldown";
import { Badge, Notice, PageTitle, Panel, useAdminApi, when } from "./shared";

type Account = {
  email: string;
  sessionExpires: number;
  activeSessions: number;
  recentSignIns: { at: number; ok: number }[];
};

type AdminList = {
  me: string;
  canManage: boolean;
  max: number;
  mainAdmins: string[];
  admins: { email: string; addedBy: string; addedAt: number }[];
};

/** Who can sign in. The main admin can't be removed; only the main admin adds or removes others. */
function Admins() {
  const adminApi = useAdminApi();
  const [list, setList] = useState<AdminList | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // A short pause after each change (the Worker also limits changes per minute).
  const pause = useCooldown();

  const load = useCallback(async () => {
    const r = await adminApi<AdminList>("/admins");
    if (r.ok) setList(r.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => void load(), [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (busy || pause.active || !newEmail.trim()) return;
    setBusy(true);
    setMsg(null);
    const r = await adminApi<AdminList>("/admins", { method: "POST", json: { email: newEmail.trim() } });
    setBusy(false);
    pause.start(3);
    if (r.ok) {
      setList(r.data);
      setNewEmail("");
      setMsg({ tone: "ok", text: "Added. They and the main admin were emailed." });
    } else setMsg({ tone: "error", text: r.error });
  }

  async function remove(email: string) {
    if (busy || pause.active) return;
    if (!confirm(`Remove ${email}? They will be signed out straight away and can't sign in again.`)) return;
    setBusy(true);
    setMsg(null);
    const r = await adminApi<AdminList>("/admins", { method: "DELETE", json: { email } });
    setBusy(false);
    pause.start(3);
    if (r.ok) {
      setList(r.data);
      setMsg({ tone: "ok", text: "Removed. They were signed out and emailed." });
    } else setMsg({ tone: "error", text: r.error });
  }

  return (
    <Panel title="Who can sign in">
      {!list ? (
        <p className="text-ink-muted">Loading…</p>
      ) : (
        <div className="space-y-5">
          <ul className="divide-y divide-line">
            {list.mainAdmins.map((email) => (
              <li key={email} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="font-semibold break-all text-ink">{email}</span>
                <Badge tone="gold">Main admin · can&apos;t be removed</Badge>
              </li>
            ))}
            {list.admins.map((a) => (
              <li key={a.email} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block font-semibold break-all text-ink">{a.email}</span>
                  <span className="block text-sm text-ink-muted">
                    Added {when(a.addedAt, false)} by {a.addedBy}
                  </span>
                </span>
                {list.canManage ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || pause.active}
                    onClick={() => void remove(a.email)}
                  >
                    <UserMinus className="size-4" aria-hidden="true" />
                    Remove
                  </Button>
                ) : (
                  <Badge>Admin</Badge>
                )}
              </li>
            ))}
          </ul>

          {list.canManage ? (
            <form onSubmit={add} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field
                id="new-admin"
                label="Add an admin"
                hint={`Up to ${list.max} extra admins. They sign in with this email and a one-time code.`}
                className="sm:flex-1"
              >
                <TextInput
                  id="new-admin"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoComplete="off"
                  maxLength={254}
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  aria-describedby="new-admin-hint"
                />
              </Field>
              <Button type="submit" disabled={busy || pause.active || !newEmail.trim()}>
                <UserPlus className="size-4" aria-hidden="true" />
                {pause.active ? `Wait ${pause.secondsLeft}s` : "Add admin"}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-ink-muted">Only the main admin can add or remove admins.</p>
          )}
          {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
        </div>
      )}
    </Panel>
  );
}

/** Site settings. The website inbox is off unless an admin turns it on here. */
function Settings({ onInboxChange }: { onInboxChange: (on: boolean) => void }) {
  const adminApi = useAdminApi();
  const [inbox, setInbox] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    void adminApi<{ inbox: boolean }>("/contact-mode").then((r) => r.ok && setInbox(r.data.inbox));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle() {
    if (inbox === null || busy) return;
    const next = !inbox;
    setBusy(true);
    setMsg(null);
    const r = await adminApi<{ inbox: boolean }>("/contact-mode", { method: "PUT", json: { inbox: next } });
    setBusy(false);
    setAsking(false);
    if (!r.ok) return setMsg({ tone: "error", text: r.error });
    setInbox(r.data.inbox);
    onInboxChange(r.data.inbox);
    setMsg({
      tone: "ok",
      text: r.data.inbox
        ? "Website inbox is on. Contact form messages now arrive in the Messages tab and by email."
        : "Website inbox is off. The Contact form now opens WhatsApp, and nothing is stored here.",
    });
  }

  return (
    <Panel title="Settings">
      <div className="flex items-start justify-between gap-4 rounded-2xl bg-ivory p-4">
        <div>
          <p className="font-semibold text-ink">Website inbox for the Contact form</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {inbox
              ? "On: messages are saved in the Messages tab and emailed to Satakshi."
              : "Off: visitors write a message and it opens in WhatsApp. Nothing is stored on the site and the Messages tab is hidden."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={inbox === true}
          aria-label="Website inbox for the Contact form"
          disabled={inbox === null || busy}
          onClick={() => setAsking(true)}
          className={cn(
            "relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-700 disabled:opacity-60",
            inbox ? "bg-gold-700" : "bg-[#d8d2c6]",
          )}
        >
          <span
            className={cn(
              "absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform",
              inbox && "translate-x-5",
            )}
          />
        </button>
      </div>
      {msg ? (
        <div className="mt-4">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      ) : null}

      <ConfirmDialog
        open={asking}
        title={inbox ? "Turn the website inbox off?" : "Turn the website inbox on?"}
        confirmLabel={inbox ? "Turn off" : "Turn on"}
        busy={busy}
        onConfirm={() => void toggle()}
        onCancel={() => setAsking(false)}
      >
        {inbox ? (
          <p>
            The Contact form will go back to opening WhatsApp. Messages already in the Messages tab are kept,
            but new ones won&apos;t be saved on the site, and the Messages tab will be hidden.
          </p>
        ) : (
          <p>
            The Contact form will save each message in the Messages tab and email it to Satakshi. Messages are
            stored on this website from then on.
          </p>
        )}
      </ConfirmDialog>
    </Panel>
  );
}

export function AdminAccount({
  onSignOutAll,
  onInboxChange,
}: {
  onSignOutAll: () => void;
  onInboxChange: (on: boolean) => void;
}) {
  const adminApi = useAdminApi();
  const [acc, setAcc] = useState<Account | null>(null);

  const load = useCallback(async () => {
    const r = await adminApi<Account>("/account");
    if (r.ok) setAcc(r.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => void load(), [load]);

  return (
    <>
      <PageTitle title="Account" />
      <Panel title="Sign-in">
        {acc ? (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
            <dt className="text-sm text-ink-muted">Signed in as</dt>
            <dd className="font-semibold break-all text-ink">{acc.email}</dd>
            <dt className="text-sm text-ink-muted">How you sign in</dt>
            <dd className="flex items-center gap-2 text-ink">
              <Mail className="size-4 text-gold-700" aria-hidden="true" /> A one-time code sent to your email
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
        <p className="mt-5 flex items-start gap-2 text-sm text-ink-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gold-700" aria-hidden="true" />
          There is no password to forget or steal. Keep your email account safe with two-step verification,
          because whoever can read that inbox can sign in here.
        </p>
      </Panel>

      <Settings onInboxChange={onInboxChange} />

      <Admins />

      <Panel title="Recent sign-in attempts">
        {acc?.recentSignIns.length ? (
          <ul className="divide-y divide-line text-sm">
            {acc.recentSignIns.map((a) => (
              <li key={a.at} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-ink tabular">{when(a.at)}</span>
                <Badge tone={a.ok ? "green" : "red"}>{a.ok ? "Signed in" : "Wrong code"}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">None in the last day.</p>
        )}
      </Panel>
    </>
  );
}
