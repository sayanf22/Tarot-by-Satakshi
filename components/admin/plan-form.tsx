"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { TarotImage } from "@/components/media/tarot-image";
import { Button } from "@/components/ui/button";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { ServiceGlyph } from "@/components/ui/service-glyph";
import { cn } from "@/lib/cn";
import { formatDuration, formatPrice } from "@/lib/format";
import { categoryLabels, sessionLabel, type Service, type ServiceIcon, type TarotCardId } from "@/lib/types";
import { PlanPreview } from "./plan-preview";
import { Notice, useAdminApi } from "./shared";

export type Plan = {
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

export type Photo = { key: string; alt: string };

export type Form = {
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
  active: boolean;
  sortOrder: string;
  imageKey: string;
  /** Where the plan sits among the others. "keep" is only used when editing. */
  position: "keep" | "end" | "start";
};

export const blank: Form = {
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
  active: true,
  sortOrder: "10",
  imageKey: "",
  position: "end",
};

export function toForm(p: Plan): Form {
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
    price: p.price_paise ? String(Math.round(p.price_paise / 100)) : "",
    active: p.active === 1,
    sortOrder: String(p.sort_order),
    imageKey: p.image_key ?? "",
    position: "keep",
  };
}

const icons: { id: ServiceIcon; label: string }[] = [
  { id: "cards", label: "Cards" },
  { id: "heart", label: "Heart" },
  { id: "sun", label: "Sun" },
  { id: "moon", label: "Moon" },
  { id: "star", label: "Compass" },
  { id: "wheel", label: "Wheel" },
  { id: "eye", label: "Eye" },
];

const cards: [TarotCardId, string][] = [
  ["priestess", "The High Priestess"],
  ["two-cups", "Two of Cups"],
  ["ace-pentacles", "Ace of Pentacles"],
  ["wheel", "Wheel of Fortune"],
  ["hermit", "The Hermit"],
  ["moon", "The Moon"],
];

// Quick picks only save typing: any amount from ₹1 to ₹1,00,000 and any length from 10 to 240 minutes works.
const pricePicks = [500, 1000, 1500, 2000, 3000, 5000];
const lengthPicks = [15, 30, 45, 60, 90, 120];
const MAX_PRICE = 100_000;

const steps = ["Basics", "Price", "Look", "Publish"] as const;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

type Errors = { name?: string; price?: string; duration?: string; formats?: string };

function validate(f: Form): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 2) e.name = "Give the plan a name.";
  const price = Number(f.price);
  if (!f.price || !Number.isFinite(price) || price < 1 || price > MAX_PRICE)
    e.price = "Enter a price from ₹1 to ₹1,00,000.";
  const mins = Number(f.duration);
  if (!Number.isInteger(mins) || mins < 10 || mins > 240) e.duration = "Length must be 10 to 240 minutes.";
  if (!f.call && !f.text) e.formats = "Choose call, text or both.";
  return e;
}

const stepOf = (e: Errors) => (e.name ? 0 : e.price || e.duration || e.formats ? 1 : -1);

function Chip({
  active,
  onClick,
  children,
  className,
  label,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-700",
        active
          ? "border-gold-600 bg-ivory text-ink ring-1 ring-gold-600"
          : "border-line bg-white text-ink-muted hover:border-gold-500 hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** A big tile you tap to choose one thing (card art, photo, type). */
function Tile({
  active,
  onClick,
  label,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative rounded-2xl border bg-white p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-700",
        active ? "border-gold-600 bg-ivory ring-1 ring-gold-600" : "border-line hover:border-gold-500",
        className,
      )}
    >
      {children}
      {active ? (
        <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-gold-700 text-white">
          <Check className="size-3" strokeWidth={3} aria-hidden="true" />
        </span>
      ) : null}
    </button>
  );
}

function Stepper({ step, reached, onGo }: { step: number; reached: number; onGo: (i: number) => void }) {
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Steps">
      {steps.map((label, i) => {
        const done = i < step;
        const here = i === step;
        const open = i <= reached;
        return (
          <li key={label}>
            <button
              type="button"
              disabled={!open}
              aria-current={here ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${label}`}
              onClick={() => onGo(i)}
              className="group flex w-full flex-col gap-2 text-left disabled:cursor-not-allowed"
            >
              <span
                className={cn(
                  "h-1.5 rounded-full transition-colors",
                  here || done ? "bg-gold-600" : "bg-line",
                )}
              />
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs",
                    here
                      ? "bg-gold-700 text-white"
                      : done
                        ? "bg-champagne text-gold-800"
                        : "bg-[#efece6] text-ink-muted",
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : i + 1}
                </span>
                <span className={cn("truncate", here ? "text-ink" : "text-ink-muted")}>{label}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-ivory p-4">
      <div>
        <p className="font-semibold text-ink">{label}</p>
        <p className="mt-0.5 text-sm text-ink-muted">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-700",
          checked ? "bg-gold-700" : "bg-[#d8d2c6]",
        )}
      >
        <span
          className={cn(
            "absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

export function PlanForm({
  initial,
  isNew,
  photos,
  others,
  onDone,
  onSaved,
}: {
  initial: Form;
  isNew: boolean;
  photos: Photo[];
  /** The other plans, to pick a free web address and an order. */
  others: { slug: string; name: string; sort_order: number }[];
  onDone: () => void;
  onSaved: (message: string) => void;
}) {
  const adminApi = useAdminApi();
  const [f, setF] = useState(initial);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(isNew ? 0 : steps.length - 1);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookTouched, setLookTouched] = useState(!isNew);
  const [editSlug, setEditSlug] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const errors = useMemo(() => validate(f), [f]);
  const dirty = useMemo(() => JSON.stringify(f) !== JSON.stringify(initial), [f, initial]);
  const last = step === steps.length - 1;

  const sameName = others.find(
    (o) => o.slug !== f.slug && o.name.trim().toLowerCase() === f.name.trim().toLowerCase(),
  );
  const minOrder = others.length ? Math.min(...others.map((o) => o.sort_order)) : 10;
  const maxOrder = others.length ? Math.max(...others.map((o) => o.sort_order)) : 10;
  const canGoFirst = others.length > 0 && minOrder >= 1;

  // A free web address: the name's, or the name's with -2, -3 ... when it is taken.
  function freeSlug() {
    const base = f.slug || slugify(f.name) || "plan";
    const taken = new Set(others.map((o) => o.slug));
    if (!taken.has(base)) return base;
    for (let n = 2; n < 100; n++) {
      const candidate = `${base.slice(0, 56)}-${n}`;
      if (!taken.has(candidate)) return candidate;
    }
    return `${base.slice(0, 40)}-${others.length + 100}`;
  }

  function changeCategory(category: Form["category"]) {
    setF((x) => ({
      ...x,
      category,
      // Until she picks a look herself, the look follows the type.
      ...(lookTouched
        ? {}
        : category === "astrology"
          ? { icon: "star", card: "wheel" }
          : { icon: "cards", card: "priestess" }),
    }));
  }

  function look<K extends "icon" | "card" | "imageKey">(k: K, v: string) {
    setLookTouched(true);
    set(k, v as Form[K]);
  }

  function adjustPrice(delta: number) {
    const n = Number(f.price) || 0;
    set("price", String(Math.min(MAX_PRICE, Math.max(1, n + delta))));
  }

  function go(i: number) {
    setShowErrors(false);
    setError(null);
    setStep(i);
  }

  function next() {
    const invalid =
      step === 0
        ? Boolean(errors.name)
        : step === 1
          ? Boolean(errors.price || errors.duration || errors.formats)
          : false;
    if (invalid) {
      setShowErrors(true);
      return;
    }
    const to = Math.min(step + 1, steps.length - 1);
    setReached((r) => Math.max(r, to));
    go(to);
  }

  function cancel() {
    if (dirty && !confirm("Close without saving your changes?")) return;
    onDone();
  }

  async function save() {
    setError(null);
    const bad = stepOf(errors);
    if (bad !== -1) {
      setShowErrors(true);
      setStep(bad);
      return;
    }
    const sortOrder =
      f.position === "end"
        ? Math.min(1000, maxOrder + 10)
        : f.position === "start"
          ? Math.max(0, minOrder - 1)
          : Number(f.sortOrder) || 0;
    const body = {
      name: f.name.trim(),
      category: f.category,
      summary: f.summary.trim(),
      icon: f.icon,
      card: f.card,
      formats: [f.call && "call", f.text && "text"].filter(Boolean),
      durationMin: Number(f.duration),
      pricePaise: Math.round(Number(f.price) * 100),
      active: f.active,
      sortOrder,
      imageKey: f.imageKey || null,
    };
    setBusy(true);
    const r = isNew
      ? await adminApi("/services", { method: "POST", json: { ...body, slug: freeSlug() } })
      : await adminApi(`/services/${f.slug}`, { method: "PUT", json: body });
    setBusy(false);
    if (r.ok) {
      onSaved(
        body.active
          ? `${body.name} is saved and on the website now.`
          : `${body.name} is saved. It's hidden: turn on "Show on the website" to show it.`,
      );
    } else setError(r.error);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (last) void save();
    else next();
  }

  const priceN = Number(f.price);
  const minsN = Number(f.duration);
  const chosenFormats = [f.call && "call", f.text && "text"].filter(Boolean) as ("call" | "text")[];
  const draft: Service & { pricePaise: number } = {
    slug: (isNew ? freeSlug() : f.slug) || "your-plan",
    name: f.name.trim() || "Your plan name",
    category: f.category,
    summary: f.summary.trim() || "A short line about this reading.",
    icon: f.icon as ServiceIcon,
    card: f.card as TarotCardId,
    formats: chosenFormats.length ? chosenFormats : ["call"],
    durationMin: Number.isInteger(minsN) && minsN > 0 ? minsN : undefined,
    pricePaise: !errors.price ? Math.round(priceN * 100) : 0,
    image: f.imageKey ? `/media/${f.imageKey}` : undefined,
  };

  const seen = (k: keyof Errors) => (showErrors ? errors[k] : undefined);

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_21rem]">
      <form onSubmit={submit} className="min-w-0 space-y-7" noValidate>
        <Stepper step={step} reached={reached} onGo={go} />

        {step === 0 ? (
          <div className="space-y-6">
            <Field
              id="p-name"
              label="Plan name"
              error={seen("name")}
              hint={
                sameName ? (
                  <span className="text-danger">A plan called “{sameName.name}” already exists.</span>
                ) : undefined
              }
            >
              <TextInput
                id="p-name"
                value={f.name}
                maxLength={80}
                aria-invalid={Boolean(seen("name"))}
                aria-describedby={sameName ? "p-name-hint" : seen("name") ? "p-name-error" : undefined}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>

            <Field
              id="p-summary"
              label="One-line description"
              optional
              hint={`${f.summary.length}/300. Shown on the card and the Pricing page.`}
            >
              <TextArea
                id="p-summary"
                rows={2}
                maxLength={300}
                value={f.summary}
                onChange={(e) => set("summary", e.target.value)}
                aria-describedby="p-summary-hint"
                className="min-h-0"
              />
            </Field>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink">Type of reading</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["tarot", "astrology"] as const).map((c) => (
                  <Tile
                    key={c}
                    active={f.category === c}
                    onClick={() => changeCategory(c)}
                    label={categoryLabels[c]}
                    className="p-4"
                  >
                    <span className="block font-semibold text-ink">{categoryLabels[c]}</span>
                    <span className="mt-0.5 block pr-6 text-sm text-ink-muted">
                      {c === "tarot"
                        ? "Booking asks for name, email and phone."
                        : "Booking also asks for birth date, time and place."}
                    </span>
                  </Tile>
                ))}
              </div>
            </fieldset>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-7">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink">Price</legend>
              <div className="flex items-stretch gap-2">
                <button
                  type="button"
                  aria-label="Lower the price by ₹100"
                  onClick={() => adjustPrice(-100)}
                  className="flex w-12 shrink-0 items-center justify-center rounded-2xl border border-line bg-white text-ink-muted transition-colors hover:border-gold-500 hover:text-ink"
                >
                  <Minus className="size-4" aria-hidden="true" />
                </button>
                <div className="relative min-w-0 flex-1">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg text-ink-muted"
                  >
                    ₹
                  </span>
                  <TextInput
                    id="p-price"
                    inputMode="numeric"
                    aria-label="Price in rupees"
                    aria-invalid={Boolean(seen("price"))}
                    aria-describedby="p-price-note"
                    value={f.price}
                    onChange={(e) => set("price", e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="pl-9 text-center font-display text-2xl tabular"
                  />
                </div>
                <button
                  type="button"
                  aria-label="Raise the price by ₹100"
                  onClick={() => adjustPrice(100)}
                  className="flex w-12 shrink-0 items-center justify-center rounded-2xl border border-line bg-white text-ink-muted transition-colors hover:border-gold-500 hover:text-ink"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {pricePicks.map((p) => (
                  <Chip key={p} active={Number(f.price) === p} onClick={() => set("price", String(p))}>
                    {formatPrice(p * 100)}
                  </Chip>
                ))}
              </div>
              <p
                id="p-price-note"
                role={seen("price") ? "alert" : undefined}
                className={cn("mt-3 text-sm", seen("price") ? "font-medium text-danger" : "text-ink-muted")}
              >
                {seen("price") ??
                  (errors.price
                    ? "Type an amount or tap a quick pick. Clients pay this online when they book."
                    : `Clients pay ${formatPrice(priceN * 100)} online when they book.`)}
              </p>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink">Length</legend>
              <div className="flex flex-wrap items-center gap-2">
                {lengthPicks.map((m) => (
                  <Chip key={m} active={minsN === m} onClick={() => set("duration", String(m))}>
                    {formatDuration(m)}
                  </Chip>
                ))}
                <label htmlFor="p-duration" className="ml-1 flex items-center gap-2 text-sm text-ink-muted">
                  Other
                  <TextInput
                    id="p-duration"
                    inputMode="numeric"
                    aria-label="Length in minutes"
                    aria-invalid={Boolean(seen("duration"))}
                    value={f.duration}
                    onChange={(e) => set("duration", e.target.value.replace(/\D/g, "").slice(0, 3))}
                    className="w-20 rounded-full px-3 py-2 text-center text-sm"
                  />
                  min
                </label>
              </div>
              {seen("duration") ? (
                <p role="alert" className="mt-3 text-sm font-medium text-danger">
                  {seen("duration")}
                </p>
              ) : null}
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink">How the session happens</legend>
              <div className="flex flex-wrap gap-2">
                <Chip active={f.call} onClick={() => set("call", !f.call)}>
                  Call
                </Chip>
                <Chip active={f.text} onClick={() => set("text", !f.text)}>
                  Text
                </Chip>
              </div>
              {seen("formats") ? (
                <p role="alert" className="mt-3 text-sm font-medium text-danger">
                  {seen("formats")}
                </p>
              ) : (
                <p className="mt-3 text-sm text-ink-muted">Clients choose one of these when they book.</p>
              )}
            </fieldset>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-7">
            <fieldset>
              <legend className="mb-1 text-sm font-semibold text-ink">Card artwork</legend>
              <p className="mb-3 text-sm text-ink-muted">The tarot card shown on the home page card.</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 md:grid-cols-3">
                {cards.map(([id, name]) => (
                  <Tile key={id} active={f.card === id} onClick={() => look("card", id)} label={name}>
                    <span className="relative block aspect-[7/11]">
                      <TarotImage
                        id={id}
                        sizes="120px"
                        decorative
                        className="absolute inset-0 size-full object-contain"
                      />
                    </span>
                    <span className="mt-2 block text-center text-xs leading-tight font-semibold text-ink">
                      {name}
                    </span>
                  </Tile>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-3 text-sm font-semibold text-ink">Icon</legend>
              <div className="flex flex-wrap gap-2">
                {icons.map((i) => (
                  <Chip
                    key={i.id}
                    active={f.icon === i.id}
                    onClick={() => look("icon", i.id)}
                    label={i.label}
                    className="size-12 p-0"
                  >
                    <ServiceGlyph icon={i.id} className="size-5" />
                  </Chip>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-1 flex w-full items-baseline justify-between text-sm font-semibold text-ink">
                Photo <span className="text-xs font-medium text-ink-muted">Optional</span>
              </legend>
              <p className="mb-3 text-sm text-ink-muted">
                Shown on the Pricing page, whole and never cropped. Add photos in the Images tab first.
              </p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-3">
                <Tile active={!f.imageKey} onClick={() => look("imageKey", "")} label="No photo">
                  <span className="flex aspect-[4/3] items-center justify-center rounded-xl bg-ivory text-xs font-semibold text-ink-muted">
                    No photo
                  </span>
                </Tile>
                {photos.map((p) => (
                  <Tile
                    key={p.key}
                    active={f.imageKey === p.key}
                    onClick={() => look("imageKey", p.key)}
                    label={p.alt || "Photo"}
                  >
                    {/* Whole photo, never cropped. */}
                    {/* oxlint-disable-next-line nextjs/no-img-element -- admin thumbnails */}
                    <img
                      src={`/media/${p.key}`}
                      alt=""
                      loading="lazy"
                      className="aspect-[4/3] w-full rounded-xl bg-ivory object-contain"
                    />
                  </Tile>
                ))}
              </div>
              {photos.length === 0 ? (
                <p className="mt-3 text-sm text-ink-muted">No photos uploaded yet.</p>
              ) : null}
            </fieldset>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-line p-5">
              <h3 className="font-display text-xl text-ink">Check your plan</h3>
              <dl className="mt-3 divide-y divide-line text-sm">
                {(
                  [
                    [0, "Name", f.name.trim() || "—"],
                    [0, "Type", categoryLabels[f.category]],
                    [1, "Price", errors.price ? "—" : formatPrice(priceN * 100)],
                    [1, "Length", errors.duration ? "—" : formatDuration(minsN)],
                    [1, "Session", errors.formats ? "—" : sessionLabel(chosenFormats)],
                  ] as [number, string, string][]
                ).map(([to, k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4 py-2.5">
                    <dt className="text-ink-muted">{k}</dt>
                    <dd className="flex items-center gap-3 font-semibold text-ink">
                      {v}
                      <button
                        type="button"
                        onClick={() => go(to)}
                        className="text-xs font-bold text-gold-800 underline underline-offset-2"
                        aria-label={`Change ${k.toLowerCase()}`}
                      >
                        Change
                      </button>
                    </dd>
                  </div>
                ))}
              </dl>
              {showErrors && stepOf(errors) !== -1 ? (
                <div className="mt-3">
                  <Notice tone="error">
                    Some details are missing. Use Change next to the lines marked “—”.
                  </Notice>
                </div>
              ) : null}
            </div>

            <Toggle
              checked={f.active}
              onChange={(v) => set("active", v)}
              label="Show on the website"
              hint={
                f.active ? "Visitors can see and book this plan." : "Hidden. Visitors can’t see or book it."
              }
            />

            <Field id="p-position" label="Position on the site">
              <select
                id="p-position"
                value={f.position}
                onChange={(e) => set("position", e.target.value as Form["position"])}
                className="block w-full rounded-2xl border border-line bg-white px-4 py-3 text-[0.975rem] text-ink hover:border-gold-500 focus:border-gold-700 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold-700"
              >
                {!isNew ? <option value="keep">Keep where it is</option> : null}
                <option value="end">{isNew ? "After my other plans" : "Move to the end"}</option>
                {canGoFirst || f.position === "start" ? (
                  <option value="start">{isNew ? "Before my other plans" : "Move to the start"}</option>
                ) : null}
              </select>
            </Field>

            {isNew ? (
              <div className="text-sm text-ink-muted">
                Web address: <span className="font-semibold text-ink">/book?service={freeSlug()}</span>{" "}
                {!editSlug ? (
                  <button
                    type="button"
                    onClick={() => setEditSlug(true)}
                    className="font-bold text-gold-800 underline underline-offset-2"
                  >
                    Change
                  </button>
                ) : (
                  <div className="mt-3 max-w-sm">
                    <Field
                      id="p-slug"
                      label="Custom web address"
                      hint="Lowercase letters, numbers and dashes."
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
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <Notice tone="error">{error}</Notice> : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
          {step > 0 ? (
            <Button variant="outline" onClick={() => go(step - 1)}>
              Back
            </Button>
          ) : null}
          {last ? (
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : isNew ? "Add plan" : "Save changes"}
            </Button>
          ) : (
            <>
              <Button type="submit">Next</Button>
              {!isNew ? (
                <Button variant="outline" disabled={busy} onClick={() => void save()}>
                  {busy ? "Saving…" : "Save changes"}
                </Button>
              ) : null}
            </>
          )}
          <button
            type="button"
            onClick={cancel}
            className="ml-auto text-sm font-semibold text-ink-muted underline underline-offset-4 hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </form>

      <aside className="min-w-0 max-md:order-first md:sticky md:top-32 md:self-start lg:top-10">
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          aria-expanded={showPreview}
          className="mb-3 text-sm font-semibold text-gold-800 underline underline-offset-4 md:hidden"
        >
          {showPreview ? "Hide preview" : "Show preview"}
        </button>
        <div className={cn(!showPreview && "max-md:hidden")}>
          <PlanPreview draft={draft} />
        </div>
      </aside>
    </div>
  );
}
