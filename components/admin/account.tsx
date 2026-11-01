"use client";

import { Mail, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, PageTitle, Panel, useAdminApi, when } from "./shared";

type Account = {
  email: string;
  admins: string[];
  sessionExpires: number;
  activeSessions: number;
  recentSignIns: { at: number; ok: number }[];
};

export function AdminAccount({ onSignOutAll }: { onSignOutAll: () => void }) {
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
            <dt className="text-sm text-ink-muted">Admin emails</dt>
            <dd className="break-all text-ink">{acc.admins.join(", ")}</dd>
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
          because whoever can read that inbox can sign in here. To add or remove an admin, change ADMIN_EMAILS
          in the Worker settings.
        </p>
      </Panel>

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
