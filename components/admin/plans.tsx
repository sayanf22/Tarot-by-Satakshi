"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { blank, PlanForm, toForm, type Form, type Photo, type Plan } from "./plan-form";
import { Badge, Empty, Notice, PageTitle, Panel, rupees, useAdminApi } from "./shared";
export function AdminPlans() {
  const adminApi = useAdminApi();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [editing, setEditing] = useState<{ form: Form; isNew: boolean } | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [home, setHome] = useState<{ value: number; min: number; max: number } | null>(null);

  const load = useCallback(async () => {
    const [p, m] = await Promise.all([
      adminApi<{ services: Plan[]; homeCards: number; homeCardsRange: { min: number; max: number } }>(
        "/services",
      ),
      adminApi<{ media: Photo[] }>("/media"),
    ]);
    if (p.ok) {
      setPlans(p.data.services);
      setHome({ value: p.data.homeCards, ...p.data.homeCardsRange });
    }
    if (m.ok) setPhotos(m.data.media.map((x) => ({ key: x.key, alt: x.alt })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => void load(), [load]);

  async function archive(p: Plan, archived: boolean) {
    const r = await adminApi(`/services/${p.slug}`, { method: "PATCH", json: { archived } });
    setMsg(
      r.ok
        ? { tone: "ok", text: archived ? `${p.name} is hidden.` : `${p.name} is back.` }
        : { tone: "error", text: r.error },
    );
    await load();
  }

  async function remove(p: Plan) {
    if (!confirm(`Delete ${p.name} for good?`)) return;
    const r = await adminApi(`/services/${p.slug}`, { method: "DELETE" });
    setMsg(r.ok ? { tone: "ok", text: `${p.name} deleted.` } : { tone: "error", text: r.error });
    await load();
  }

  async function saveHome(value: number) {
    const r = await adminApi("/home-cards", { method: "PUT", json: { homeCards: value } });
    setMsg(
      r.ok
        ? {
            tone: "ok",
            text: `The home page will show ${value} plans. Use Publish to website to update it.`,
          }
        : { tone: "error", text: r.error },
    );
    if (r.ok) setHome((h) => (h ? { ...h, value } : h));
  }

  async function publish() {
    const r = await adminApi("/publish", { method: "POST", json: {} });
    setMsg(
      r.ok
        ? { tone: "ok", text: "The website is updating. Changes show on every page in about 2 minutes." }
        : { tone: "error", text: r.error },
    );
  }

  return (
    <>
      <PageTitle
        title="Plans"
        action={
          <>
            <Button size="sm" variant="outline" onClick={() => void publish()}>
              Publish to website
            </Button>
            <Button size="sm" onClick={() => setEditing({ form: blank, isNew: true })}>
              Add a plan
            </Button>
          </>
        }
      />
      <Notice>
        Changes are live on the booking page straight away. Use <strong>Publish to website</strong> to update
        the home and Services pages too.
      </Notice>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}

      {home ? (
        <Panel title="Home page">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <Field
              id="home-cards"
              label="Plans in the home page deck"
              hint={`The first ${home.value} live plans, in order. The Services and Pricing pages always list every plan.`}
              className="sm:flex-1"
            >
              <select
                id="home-cards"
                aria-describedby="home-cards-hint"
                className={inputClasses}
                value={home.value}
                onChange={(e) => void saveHome(Number(e.target.value))}
              >
                {Array.from({ length: home.max - home.min + 1 }, (_, i) => home.min + i).map((v) => (
                  <option key={v} value={v}>
                    {v} plans
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Panel>
      ) : null}

      {editing ? (
        <Panel title={editing.isNew ? "New plan" : `Edit ${editing.form.name}`}>
          <PlanForm
            key={editing.form.slug || "new"}
            initial={editing.form}
            isNew={editing.isNew}
            photos={photos}
            others={(plans ?? []).filter((p) => p.slug !== editing.form.slug)}
            onDone={() => setEditing(null)}
            onSaved={(text) => {
              setEditing(null);
              setMsg({ tone: "ok", text });
              void load();
            }}
          />
        </Panel>
      ) : null}

      <Panel>
        {!plans ? (
          <p className="text-ink-muted">Loading…</p>
        ) : plans.length === 0 ? (
          <Empty>No plans yet. Add your first one.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {plans.map((p) => (
              <li key={p.slug} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 sm:flex-1">
                  <p className="font-semibold text-ink">
                    {p.name}{" "}
                    {p.archived ? (
                      <Badge>Archived</Badge>
                    ) : !p.active ? (
                      <Badge>Hidden</Badge>
                    ) : p.is_sample ? (
                      <Badge tone="gold">Sample</Badge>
                    ) : (
                      <Badge tone="green">Live</Badge>
                    )}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {p.category === "astrology" ? "Astrology" : "Tarot"} ·{" "}
                    {p.duration_min ? `${p.duration_min} min` : "no length"} ·{" "}
                    {p.price_paise ? rupees(p.price_paise) : "no price"} · {p.booking_count} bookings
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing({ form: toForm(p), isNew: false })}
                  >
                    Edit
                  </Button>
                  {p.archived ? (
                    <Button size="sm" variant="outline" onClick={() => void archive(p, false)}>
                      Restore
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => void archive(p, true)}>
                      Archive
                    </Button>
                  )}
                  {p.booking_count === 0 ? (
                    <Button size="sm" variant="outline" onClick={() => void remove(p)}>
                      Delete
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
