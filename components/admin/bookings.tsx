"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { Badge, PageTitle, Empty, Notice, Panel, rupees, statusTone, useAdminApi, when } from "./shared";

type Row = {
  id: string;
  service_snapshot: string;
  session_format: string;
  start_at: number;
  status: string;
  hold_expires_at: number | null;
  client_name: string;
  client_email: string;
  client_phone: string;
  amount_paise: number;
  payment_status: string | null;
};
type Detail = Row & {
  topic: string;
  question: string;
  answers_json: string;
  admin_note: string;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  method: string | null;
  refunded_paise: number | null;
  created_at: number;
};

const scopes = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "attention", label: "Refunds" },
] as const;

const serviceName = (s: string) => (JSON.parse(s) as { name: string }).name;

function BookingDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const adminApi = useAdminApi();
  const [b, setB] = useState<Detail | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await adminApi<{ booking: Detail }>(`/bookings/${id}`);
    if (r.ok) {
      setB(r.data.booking);
      setNote(r.data.booking.admin_note);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => void load(), [load]);

  async function act(action: "complete" | "cancel" | "reopen" | "note") {
    if (
      action === "cancel" &&
      !confirm(
        "Cancel this booking? The time becomes free again. Money is not returned unless you also refund.",
      )
    )
      return;
    setBusy(true);
    const r = await adminApi(`/bookings/${id}`, { method: "PATCH", json: { action, note } });
    setBusy(false);
    setMsg(r.ok ? { tone: "ok", text: "Saved." } : { tone: "error", text: r.error });
    if (r.ok) {
      await load();
      onChanged();
    }
  }

  async function refund() {
    if (!b) return;
    const left = b.amount_paise - (b.refunded_paise ?? 0);
    if (!confirm(`Refund ${rupees(left)} to ${b.client_name} through Razorpay? This can't be undone.`))
      return;
    setBusy(true);
    const r = await adminApi(`/bookings/${id}/refund`, {
      method: "POST",
      json: { reason: "Refund by Satakshi" },
    });
    setBusy(false);
    setMsg(
      r.ok
        ? { tone: "ok", text: "Refund started. Razorpay usually completes it in 5–7 working days." }
        : { tone: "error", text: r.error },
    );
    if (r.ok) {
      await load();
      onChanged();
    }
  }

  if (!b) return <p className="text-ink-muted">Loading…</p>;
  const answers = Object.entries(JSON.parse(b.answers_json) as Record<string, string | null>);
  const rows: [string, string][] = [
    ["Reading", serviceName(b.service_snapshot)],
    ["Session", b.session_format === "call" ? "Call" : "Text"],
    ["When", `${when(b.start_at)} IST`],
    ["Name", b.client_name],
    ["Email", b.client_email],
    ["WhatsApp", b.client_phone],
    ["Topic", b.topic],
    ["Question", b.question || "Not given"],
    ...answers.map(([k, v]) => [k, v ?? "Not given"] as [string, string]),
    ["Amount", rupees(b.amount_paise)],
    ["Payment", `${b.payment_status ?? "none"}${b.method ? ` (${b.method})` : ""}`],
    ["Payment id", b.gateway_payment_id ?? "—"],
    ["Reference", b.id],
  ];

  return (
    <div className="space-y-5">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-sm text-ink-muted">{k}</dt>
            <dd className="font-medium break-words whitespace-pre-line text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <div>
        <label htmlFor={`note-${b.id}`} className="mb-2 block text-sm font-semibold">
          Private note
        </label>
        <TextArea
          id={`note-${b.id}`}
          rows={3}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <div className="flex flex-wrap gap-3">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void act("note")}>
          Save note
        </Button>
        {b.status === "confirmed" ? (
          <Button size="sm" disabled={busy} onClick={() => void act("complete")}>
            Mark as done
          </Button>
        ) : null}
        {b.status === "completed" ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void act("reopen")}>
            Mark as not done
          </Button>
        ) : null}
        {b.status === "confirmed" || b.status === "held" ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void act("cancel")}>
            Cancel booking
          </Button>
        ) : null}
        {b.payment_status === "paid" ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void refund()}>
            Refund payment
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function AdminBookings() {
  const adminApi = useAdminApi();
  const [scope, setScope] = useState<(typeof scopes)[number]["id"]>("upcoming");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await adminApi<{ bookings: Row[] }>(`/bookings?scope=${scope}`);
    if (r.ok) setRows(r.data.bookings);
    else setError(r.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);
  useEffect(() => {
    setRows(null);
    void load();
  }, [load]);

  return (
    <>
      <PageTitle title="Bookings" />
      <div className="flex flex-wrap gap-2" role="tablist">
        {scopes.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={scope === s.id}
            type="button"
            onClick={() => setScope(s.id)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold ring-1",
              scope === s.id
                ? "bg-champagne text-gold-800 ring-gold-500"
                : "bg-white text-ink ring-line hover:ring-gold-500",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Panel>
        {!rows ? (
          <p className="text-ink-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <Empty>No bookings here yet.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((b) => {
              const expanded = open === b.id;
              const holdLeft =
                b.status === "held" && b.hold_expires_at ? b.hold_expires_at > Date.now() : false;
              return (
                <li key={b.id} className="py-3">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : b.id)}
                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-left"
                  >
                    <span className="min-w-[9rem] text-sm font-semibold text-ink tabular">
                      {when(b.start_at)}
                    </span>
                    <span className="flex-1 font-semibold text-ink">{b.client_name}</span>
                    <span className="text-sm text-ink-muted">
                      {serviceName(b.service_snapshot)} · {b.session_format === "call" ? "Call" : "Text"}
                    </span>
                    <Badge tone={statusTone(b.status)}>
                      {b.status === "held" ? (holdLeft ? "paying now" : "unpaid") : b.status}
                    </Badge>
                  </button>
                  {expanded ? (
                    <div className="mt-4 rounded-2xl bg-ivory p-5">
                      <BookingDetail id={b.id} onChanged={() => void load()} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
