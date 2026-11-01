"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClasses, TextArea, TextInput } from "@/components/ui/field";
import { Badge, Empty, Notice, PageTitle, Panel, rupees, useAdminApi } from "./shared";

type Plan = {
  slug: string;
  name: string;
  category: "tarot" | "astrology";
  summary: string;
  icon: string;
  card: string;
  formats: string;
  duration_min: number | null;
  price_paise: number | null;
  is_sample: number;
  active: number;
  archived: number;
  sort_order: number;
  image_key: string | null;
  booking_count: number;
};

type Form = {
  slug: string;
  name: string;
  category: "tarot" | "astrology";
  summary: string;
  icon: string;
  card: string;
  call: boolean;
  text: boolean;
  duration: string;
  price: string;
  sample: boolean;
  active: boolean;
  sortOrder: string;
  imageKey: string;
};

const icons = ["cards", "heart", "sun", "moon", "star", "wheel", "eye"];
const cards = [
  ["priestess", "The High Priestess"],
  ["two-cups", "Two of Cups"],
  ["ace-pentacles", "Ace of Pentacles"],
  ["wheel", "Wheel of Fortune"],
  ["hermit", "The Hermit"],
  ["moon", "The Moon"],
];

const blank: Form = {
  slug: "",
  name: "",
  category: "tarot",
  summary: "",
  icon: "cards",
  card: "priestess",
  call: true,
  text: true,
  duration: "60",
  price: "",
  sample: false,
  active: true,
  sortOrder: "10",
  imageKey: "",
};

function toForm(p: Plan): Form {
  return {
    slug: p.slug,
    name: p.name,
    category: p.category,
    summary: p.summary,
    icon: p.icon,
    card: p.card,
    call: p.formats.includes("call"),
    text: p.formats.includes("text"),
    duration: p.duration_min ? String(p.duration_min) : "",
    price: p.price_paise ? String(p.price_paise / 100) : "",
    sample: p.is_sample === 1,
    active: p.active === 1,
    sortOrder: String(p.sort_order),
    imageKey: p.image_key ?? "",
  };
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

function PlanForm({
  initial,
  isNew,
  images,
  onDone,
}: {
  initial: Form;
  isNew: boolean;
  images: string[];
  onDone: () => void;
}) {
  const adminApi = useAdminApi();
  const [f, setF] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const price = f.price.trim() ? Math.round(Number(f.price) * 100) : null;
    const duration = f.duration.trim() ? Number(f.duration) : null;
    if (price !== null && (!Number.isFinite(price) || price < 100))
      return setError("Enter a price of at least ₹1, or leave it empty.");
    if (duration !== null && (!Number.isInteger(duration) || duration < 10 || duration > 240))
      return setError("Length must be 10 to 240 minutes.");
    if (!f.call && !f.text) return setError("Choose call, text or both.");
    const body = {
      name: f.name.trim(),
      category: f.category,
      summary: f.summary.trim(),
      icon: f.icon,
      card: f.card,
      formats: [f.call && "call", f.text && "text"].filter(Boolean),
      durationMin: duration,
      pricePaise: price,
      sample: f.sample,
      active: f.active,
      sortOrder: Number(f.sortOrder) || 0,
      imageKey: f.imageKey || null,
    };
    setBusy(true);
    const r = isNew
      ? await adminApi("/services", { method: "POST", json: { ...body, slug: f.slug || slugify(f.name) } })
      : await adminApi(`/services/${f.slug}`, { method: "PUT", json: body });
    setBusy(false);
    if (r.ok) onDone();
    else setError(r.error);
  }

  return (
    <form onSubmit={save} className="grid gap-5 sm:grid-cols-2">
      <Field id="p-name" label="Name" className="sm:col-span-2">
        <TextInput
          id="p-name"
          value={f.name}
          maxLength={80}
          required
          onChange={(e) => set("name", e.target.value)}
        />
      </Field>
      {isNew ? (
        <Field
          id="p-slug"
          label="Web address"
          hint={`/book?service=${f.slug || slugify(f.name) || "…"}`}
          className="sm:col-span-2"
        >
          <TextInput
            id="p-slug"
            value={f.slug}
            placeholder={slugify(f.name)}
            pattern="[a-z0-9][a-z0-9-]{1,59}"
            onChange={(e) => set("slug", slugify(e.target.value))}
            aria-describedby="p-slug-hint"
          />
        </Field>
      ) : null}
      <Field id="p-summary" label="One-line description" className="sm:col-span-2">
        <TextArea
          id="p-summary"
          rows={2}
          maxLength={300}
          value={f.summary}
          onChange={(e) => set("summary", e.target.value)}
          className="min-h-0"
        />
      </Field>
      <Field id="p-price" label="Price (₹)" hint="Needed for online booking.">
        <TextInput
          id="p-price"
          inputMode="decimal"
          value={f.price}
          onChange={(e) => set("price", e.target.value.replace(/[^0-9.]/g, ""))}
          aria-describedby="p-price-hint"
        />
      </Field>
      <Field id="p-duration" label="Length (minutes)">
        <TextInput
          id="p-duration"
          inputMode="numeric"
          value={f.duration}
          onChange={(e) => set("duration", e.target.value.replace(/\D/g, ""))}
        />
      </Field>
      <Field id="p-category" label="Type">
        <select
          id="p-category"
          className={inputClasses}
          value={f.category}
          onChange={(e) => set("category", e.target.value as Form["category"])}
        >
          <option value="tarot">Tarot</option>
          <option value="astrology">Astrology (asks for birth details)</option>
        </select>
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Session types</legend>
        <div className="flex gap-5 pt-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-gold-700"
              checked={f.call}
              onChange={(e) => set("call", e.target.checked)}
            />{" "}
            Call
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-gold-700"
              checked={f.text}
              onChange={(e) => set("text", e.target.checked)}
            />{" "}
            Text
          </label>
        </div>
      </fieldset>
      <Field id="p-card" label="Card artwork">
        <select
          id="p-card"
          className={inputClasses}
          value={f.card}
          onChange={(e) => set("card", e.target.value)}
        >
          {cards.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field id="p-icon" label="Icon">
        <select
          id="p-icon"
          className={inputClasses}
          value={f.icon}
          onChange={(e) => set("icon", e.target.value)}
        >
          {icons.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </Field>
      <Field id="p-image" label="Photo" optional>
        <select
          id="p-image"
          className={inputClasses}
          value={f.imageKey}
          onChange={(e) => set("imageKey", e.target.value)}
        >
          <option value="">None</option>
          {images.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </Field>
      <Field id="p-order" label="Order on the site" hint="Lower numbers show first.">
        <TextInput
          id="p-order"
          inputMode="numeric"
          value={f.sortOrder}
          onChange={(e) => set("sortOrder", e.target.value.replace(/\D/g, ""))}
          aria-describedby="p-order-hint"
        />
      </Field>
      <div className="flex flex-col gap-3 sm:col-span-2">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="size-4 accent-gold-700"
            checked={f.active}
            onChange={(e) => set("active", e.target.checked)}
          />{" "}
          Show on the website
        </label>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="size-4 accent-gold-700"
            checked={f.sample}
            onChange={(e) => set("sample", e.target.checked)}
          />{" "}
          Sample (not bookable, shows a Sample tag)
        </label>
      </div>
      {error ? (
        <div className="sm:col-span-2">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
      <div className="flex gap-3 sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : isNew ? "Add plan" : "Save changes"}
        </Button>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AdminPlans() {
  const adminApi = useAdminApi();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ form: Form; isNew: boolean } | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [home, setHome] = useState<{ value: number; min: number; max: number } | null>(null);

  const load = useCallback(async () => {
    const [p, m] = await Promise.all([
      adminApi<{ services: Plan[]; homeCards: number; homeCardsRange: { min: number; max: number } }>(
        "/services",
      ),
      adminApi<{ media: { key: string }[] }>("/media"),
    ]);
    if (p.ok) {
      setPlans(p.data.services);
      setHome({ value: p.data.homeCards, ...p.data.homeCardsRange });
    }
    if (m.ok) setImages(m.data.media.map((x) => x.key));
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
            initial={editing.form}
            isNew={editing.isNew}
            images={images}
            onDone={() => {
              setEditing(null);
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
