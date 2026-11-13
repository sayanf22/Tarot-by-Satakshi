"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Field, inputClasses } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminCategories, type AdminCategory } from "./categories";
import { blank, PlanForm, toForm, type Form, type Photo, type Plan } from "./plan-form";
import { Badge, Empty, Notice, PageTitle, Panel, rupees, useAdminApi } from "./shared";
type PublishState = { auto: boolean; pending: boolean; lastBuildAt: number | null };

/** Plain answers to "is my plan on the website?" and "can clients pay?". */
function SiteStatus({
  liveCount,
  payments,
  publish,
}: {
  liveCount: number;
  payments: boolean | null;
  publish: PublishState | null;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      <li className="flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-line">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#25603a]" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-semibold text-ink">
            {liveCount === 1 ? "1 plan is" : `${liveCount} plans are`} on the website
          </p>
          <p className="mt-0.5 text-ink-muted">
            Saved changes show on the Home, Services, Pricing and Booking pages straight away. Nothing else to
            press.
            {publish?.auto && publish.pending
              ? " Search engines get the update within about 10 minutes."
              : ""}
          </p>
        </div>
      </li>
      <li
        className={cn(
          "flex items-start gap-3 rounded-2xl p-4 ring-1",
          payments === false ? "bg-[#fff8e6] ring-gold-500/50" : "bg-white ring-line",
        )}
      >
        {payments === false ? (
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-gold-800" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#25603a]" aria-hidden="true" />
        )}
        <div className="text-sm">
          <p className="font-semibold text-ink">
            {payments === false
              ? "Online payment is off"
              : payments
                ? "Online payment is on"
                : "Checking payment…"}
          </p>
          <p className="mt-0.5 text-ink-muted">
            {payments === false
              ? "Clients can see plans and free times, but the Pay button stays off until the Razorpay keys are added. Until then they are asked to call."
              : payments
                ? "Clients pay by Razorpay when they book."
                : ""}
          </p>
        </div>
      </li>
    </ul>
  );
}

/** The formats a plan is offered in, as the save request expects them ("call" and/or "text"). */
function formatsOf(p: Plan): ("call" | "text")[] {
  return p.formats.split(",").filter((f): f is "call" | "text" => f === "call" || f === "text");
}

/** The server requires a price, a length and at least one format on every plan. */
function canMove(p: Plan): boolean {
  return p.duration_min !== null && p.price_paise !== null && formatsOf(p).length > 0;
}

export function AdminPlans() {
  const adminApi = useAdminApi();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [editing, setEditing] = useState<{ form: Form; isNew: boolean } | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [home, setHome] = useState<{ value: number; min: number; max: number } | null>(null);
  const [publish, setPublish] = useState<PublishState | null>(null);
  const [payments, setPayments] = useState<boolean | null>(null);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [maxCategories, setMaxCategories] = useState(20);
  const [deleting, setDeleting] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [p, m, c] = await Promise.all([
      adminApi<{
        services: Plan[];
        homeCards: number;
        homeCardsRange: { min: number; max: number };
        publish: PublishState;
        payments: boolean;
      }>("/services"),
      adminApi<{ media: Photo[] }>("/media"),
      adminApi<{ categories: AdminCategory[]; max: number }>("/categories"),
    ]);
    if (p.ok) {
      setPlans(p.data.services);
      setHome({ value: p.data.homeCards, ...p.data.homeCardsRange });
      setPublish(p.data.publish);
      setPayments(p.data.payments);
    }
    if (c.ok) {
      setCategories(c.data.categories);
      setMaxCategories(c.data.max);
    }
    if (m.ok) setPhotos(m.data.media.map((x) => ({ key: x.key, alt: x.alt })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => void load(), [load]);

  async function archive(p: Plan, archived: boolean) {
    const r = await adminApi(`/services/${p.slug}`, { method: "PATCH", json: { archived } });
    setMsg(
      r.ok
        ? {
            tone: "ok",
            text: archived
              ? `${p.name} is archived: it's hidden from the website.`
              : `${p.name} is back on the website.`,
          }
        : { tone: "error", text: r.error },
    );
    await load();
  }

  /** Moves a plan to another category. Sends the whole plan, the same body the edit form saves. */
  async function moveTo(p: Plan, category: string) {
    if (category === p.category || !canMove(p) || p.duration_min === null || p.price_paise === null) return;
    setBusy(true);
    const r = await adminApi(`/services/${p.slug}`, {
      method: "PUT",
      json: {
        name: p.name,
        category,
        summary: p.summary,
        icon: p.icon,
        card: p.card,
        formats: formatsOf(p),
        durationMin: p.duration_min,
        pricePaise: p.price_paise,
        active: p.active === 1,
        sortOrder: p.sort_order,
        imageKey: p.image_key,
      },
    });
    setBusy(false);
    const to = categories.find((c) => c.slug === category)?.name ?? category;
    setMsg(
      r.ok
        ? { tone: "ok", text: `${p.name} is now in ${to}. The Services page is updated.` }
        : { tone: "error", text: r.error },
    );
    await load();
  }

  /** Deletes a plan after the admin types "delete". The server refuses while sessions are still to come. */
  async function removePlan() {
    const p = deleting;
    if (!p) return;
    setBusy(true);
    const r = await adminApi(`/services/${p.slug}`, { method: "DELETE" });
    setBusy(false);
    setDeleting(null);
    setMsg(
      r.ok
        ? { tone: "ok", text: `${p.name} is deleted. Its past bookings stay in Bookings.` }
        : { tone: "error", text: r.error },
    );
    await load();
  }

  async function saveHome(value: number) {
    const r = await adminApi("/home-cards", { method: "PUT", json: { homeCards: value } });
    setMsg(
      r.ok
        ? { tone: "ok", text: `Saved. The home page now shows up to ${value} plans.` }
        : { tone: "error", text: r.error },
    );
    if (r.ok) {
      setHome((h) => (h ? { ...h, value } : h));
      void load();
    }
  }

  const liveCount = plans?.filter((p) => p.active && !p.archived).length ?? 0;

  return (
    <>
      <PageTitle
        title="Plans"
        action={
          <Button
            size="sm"
            disabled={!categories.some((c) => c.active)}
            title={categories.some((c) => c.active) ? undefined : "Add a category first"}
            onClick={() => setEditing({ form: blank, isNew: true })}
          >
            Add a plan
          </Button>
        }
      />

      <SiteStatus liveCount={liveCount} payments={payments} publish={publish} />
      <AdminCategories categories={categories} max={maxCategories} reload={load} />
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
            categories={categories}
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
                    {p.category_name} · {p.duration_min ? `${p.duration_min} min` : "no length"} ·{" "}
                    {p.price_paise ? rupees(p.price_paise) : "no price"} · {p.booking_count} bookings
                    {p.upcoming_count > 0 ? ` · ${p.upcoming_count} still to come` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-ink-muted">
                    Move to
                    <select
                      aria-label={`Move ${p.name} to another category`}
                      className={cn(inputClasses, "w-auto py-2 text-sm")}
                      value={p.category}
                      disabled={busy || !canMove(p)}
                      title={canMove(p) ? undefined : "Set a price and length first (Edit)."}
                      onChange={(e) => void moveTo(p, e.target.value)}
                    >
                      {categories
                        .filter((c) => c.active || c.slug === p.category)
                        .map((c) => (
                          <option key={c.slug} value={c.slug}>
                            {c.name}
                            {c.active ? "" : " (hidden)"}
                          </option>
                        ))}
                    </select>
                  </label>
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
                  <span
                    title={
                      p.upcoming_count > 0
                        ? "This plan has sessions still to come. Archive it instead, or delete it after those sessions."
                        : undefined
                    }
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || p.upcoming_count > 0}
                      onClick={() => setDeleting(p)}
                    >
                      Delete
                    </Button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? "this plan"}?`}
        word="delete"
        confirmLabel="Delete plan"
        busy={busy}
        onConfirm={() => void removePlan()}
        onCancel={() => setDeleting(null)}
      >
        <p>
          The plan is removed from the website and the admin. Past bookings stay in Bookings with their own
          copy of the plan. This can&apos;t be undone.
        </p>
      </ConfirmDialog>
    </>
  );
}
