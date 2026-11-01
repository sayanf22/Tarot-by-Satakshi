"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Empty, Panel, useAdminApi, when } from "./shared";

type Enquiry = {
  id: number;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: string;
  created_at: number;
};

export function AdminMessages() {
  const adminApi = useAdminApi();
  const [archived, setArchived] = useState(false);
  const [items, setItems] = useState<Enquiry[] | null>(null);

  const load = useCallback(async () => {
    const r = await adminApi<{ enquiries: Enquiry[] }>(`/enquiries${archived ? "?archived=1" : ""}`);
    if (r.ok) setItems(r.data.enquiries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archived]);
  useEffect(() => void load(), [load]);

  async function setStatus(id: number, status: "read" | "archived" | "new") {
    await adminApi(`/enquiries/${id}`, { method: "PATCH", json: { status } });
    await load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this message for good?")) return;
    await adminApi(`/enquiries/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl">Messages</h1>
        <Button size="sm" variant="outline" onClick={() => setArchived(!archived)}>
          {archived ? "Show inbox" : "Show archived"}
        </Button>
      </div>
      <Panel>
        {!items ? (
          <p className="text-ink-muted">Loading…</p>
        ) : items.length === 0 ? (
          <Empty>{archived ? "Nothing archived." : "No messages yet."}</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((m) => (
              <li key={m.id} className="space-y-2 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-ink">{m.name}</span>
                  {m.status === "new" ? <Badge tone="gold">New</Badge> : null}
                  <span className="ml-auto text-sm text-ink-muted">{when(m.created_at)}</span>
                </div>
                <p className="text-sm text-ink-muted">
                  <a className="font-semibold text-gold-800 underline" href={`mailto:${m.email}`}>
                    {m.email}
                  </a>
                  {m.phone ? (
                    <>
                      {" · "}
                      <a
                        className="font-semibold text-gold-800 underline"
                        href={`tel:${m.phone.replace(/[^\d+]/g, "")}`}
                      >
                        {m.phone}
                      </a>
                    </>
                  ) : null}
                </p>
                <p className="break-words whitespace-pre-line text-ink">{m.message}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {m.status === "new" ? (
                    <Button size="sm" variant="outline" onClick={() => void setStatus(m.id, "read")}>
                      Mark read
                    </Button>
                  ) : null}
                  {m.status !== "archived" ? (
                    <Button size="sm" variant="outline" onClick={() => void setStatus(m.id, "archived")}>
                      Archive
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => void setStatus(m.id, "read")}>
                      Move to inbox
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => void remove(m.id)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
