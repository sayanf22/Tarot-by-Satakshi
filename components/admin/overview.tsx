"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Notice, Panel, rupees, useAdminApi, when } from "./shared";

type Overview = {
  upcoming: number;
  today: number;
  revenueMonthPaise: number;
  paymentsMonth: number;
  newMessages: number;
  plans: number;
  next: {
    id: string;
    service_snapshot: string;
    session_format: string;
    start_at: number;
    client_name: string;
  }[];
  storage: { files: number; bytes: number; capacity: number };
  payments: boolean;
  email: boolean;
  publish: boolean;
};

type Tab = "overview" | "bookings" | "plans" | "hours" | "messages" | "images";

export function AdminOverview({ onOpen }: { onOpen: (tab: Tab) => void }) {
  const adminApi = useAdminApi();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void adminApi<Overview>("/overview").then((r) => (r.ok ? setData(r.data) : setError(r.error)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <p className="text-ink-muted">Loading…</p>;

  const stats = [
    { label: "Sessions today", value: String(data.today), tab: "bookings" as const },
    { label: "Upcoming sessions", value: String(data.upcoming), tab: "bookings" as const },
    { label: "Earned this month", value: rupees(data.revenueMonthPaise), tab: "bookings" as const },
    { label: "New messages", value: String(data.newMessages), tab: "messages" as const },
  ];

  return (
    <>
      <h1 className="font-display text-4xl">Overview</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onOpen(s.tab)}
            className="rounded-[24px] bg-white p-5 text-left shadow-soft ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-gold-500"
          >
            <span className="block text-sm text-ink-muted">{s.label}</span>
            <span className="mt-2 block font-display text-3xl text-ink tabular">{s.value}</span>
          </button>
        ))}
      </div>

      <Panel
        title="Next sessions"
        action={
          <Button size="sm" variant="outline" onClick={() => onOpen("bookings")}>
            All bookings
          </Button>
        }
      >
        {data.next.length ? (
          <ul className="divide-y divide-line">
            {data.next.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="font-semibold text-ink">{b.client_name}</span>
                <span className="text-sm text-ink-muted">
                  {(JSON.parse(b.service_snapshot) as { name: string }).name} ·{" "}
                  {b.session_format === "call" ? "Call" : "Text"}
                </span>
                <span className="text-sm text-ink tabular">{when(b.start_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">No upcoming sessions yet.</p>
        )}
      </Panel>

      <Panel title="Setup">
        <ul className="space-y-3 text-[0.95rem]">
          <li className="flex items-center justify-between gap-3">
            Online payment (Razorpay)
            <Badge tone={data.payments ? "green" : "gold"}>{data.payments ? "On" : "Keys needed"}</Badge>
          </li>
          <li className="flex items-center justify-between gap-3">
            Booking emails (Resend)
            <Badge tone={data.email ? "green" : "gold"}>{data.email ? "On" : "After the domain"}</Badge>
          </li>
          <li className="flex items-center justify-between gap-3">
            Image storage
            <span className="text-sm text-ink-muted tabular">
              {data.storage.files} files · {(data.storage.bytes / 1_048_576).toFixed(1)} MB of{" "}
              {Math.round(data.storage.capacity / 1_073_741_824)} GB
            </span>
          </li>
          <li className="flex items-center justify-between gap-3">
            Live plans
            <span className="text-sm text-ink-muted tabular">{data.plans}</span>
          </li>
        </ul>
      </Panel>
    </>
  );
}
