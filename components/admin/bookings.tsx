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

/** Move a confirmed booking to another free time. */
function MoveBooking({ id, late, onMoved }: { id: string; late: boolean; onMoved: () => Promise<void> }) {
  const adminApi = useAdminApi();
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<{ value: string; label: string }[] | null>(null);
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pickDate(d: string) {
    setDate(d);
    setTime("");
    setSlots(null);
    setError(null);
    if (!d) return;
    const r = await adminApi<{ slots: { value: string; label: string }[] }>(
      `/bookings/${id}/slots?date=${d}`,
    );
    if (r.ok) setSlots(r.data.slots);
    else setError(r.error);
  }

  async function move() {
    if (!date || !time) return;
    setBusy(true);
    const r = await adminApi(`/bookings/${id}/move`, { method: "POST", json: { date, time } });
    setBusy(false);
    if (r.ok) await onMoved();
    else setError(r.error);
  }

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
      <p className="text-sm font-semibold text-ink">Move to another time</p>
      {late ? (
        <p className="mt-1 text-sm text-ink-muted">
          The session is less than 12 hours away. The policy only allows moves asked for 12 hours before.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-ink-muted">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => void pickDate(e.target.value)}
            className="rounded-xl border border-line px-3 py-2"
          />
        </label>
        {slots ? (
          slots.length ? (
            <label className="text-sm">
              <span className="mb-1 block text-ink-muted">Time (IST)</span>
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="rounded-xl border border-line px-3 py-2"
              >
                <option value="">Choose…</option>
                {slots.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm text-ink-muted">No free times that day.</p>
          )
        ) : null}
        <Button size="sm" disabled={busy || !time} onClick={() => void move()}>
          {busy ? "Moving…" : "Move booking"}
        </Button>
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

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
  // Clients may move a session if they ask at least 12 hours before it (refund policy).
  const hoursLeft = (b.start_at - Date.now()) / 3_600_000;
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
      {b.status === "confirmed" && hoursLeft > 0 ? (
        <MoveBooking
          id={b.id}
          late={hoursLeft < 12}
          onMoved={async () => {
            setMsg({ tone: "ok", text: "Moved. The client has been emailed the new time." });
            await load();
            onChanged();
          }}
        />
      ) : null}
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
