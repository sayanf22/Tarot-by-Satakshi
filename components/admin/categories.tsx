"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { Badge, Notice, Panel, useAdminApi } from "./shared";

/** A category as the admin sees it (includes hidden categories and how many plans use it). */
export type AdminCategory = {
  slug: string;
  name: string;
  description: string;
  birthDetails: boolean;
  active: boolean;
  sortOrder: number;
  planCount: number;
};

type Fields = { name: string; description: string; birthDetails: boolean; active: boolean; code: string };

const blankFields: Fields = { name: "", description: "", birthDetails: false, active: true, code: "" };

/** Name, description, birth-details question, shown-on-site switch, and an optional code. Shared by add and edit. */
function CategoryFields({
  value,
  onChange,
  isNew,
  idPrefix,
}: {
  value: Fields;
  onChange: (next: Fields) => void;
  isNew: boolean;
  idPrefix: string;
}) {
  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field id={`${idPrefix}-name`} label="Category name" className="sm:col-span-2">
        <TextInput
          id={`${idPrefix}-name`}
          value={value.name}
          maxLength={40}
          required
          onChange={(e) => set("name", e.target.value)}
        />
      </Field>
      <Field
        id={`${idPrefix}-description`}
        label="Short description"
        optional
        hint="Shown under the category heading on the Services page."
        className="sm:col-span-2"
      >
        <TextArea
          id={`${idPrefix}-description`}
          rows={2}
          maxLength={200}
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
          className="min-h-0"
        />
      </Field>
      {isNew ? (
        <Field
          id={`${idPrefix}-code`}
          label="Code"
          optional
          hint="Only needed if the name has no English letters. Letters, numbers and dashes."
        >
          <TextInput
            id={`${idPrefix}-code`}
            value={value.code}
            maxLength={40}
            spellCheck={false}
            autoCapitalize="none"
            onChange={(e) => set("code", e.target.value.toLowerCase())}
          />
        </Field>
      ) : null}
      <div className="flex flex-col gap-3 sm:col-span-2">
        <div className="flex items-start gap-3">
          <input
            id={`${idPrefix}-birth`}
            type="checkbox"
            className="mt-1 size-4 accent-gold-700"
            checked={value.birthDetails}
            onChange={(e) => set("birthDetails", e.target.checked)}
          />
          <div>
            <label htmlFor={`${idPrefix}-birth`} className="block font-semibold text-ink">
              Ask for birth details when booking
            </label>
            <p className="text-sm text-ink-muted">
              Turn on for astrology-style readings: the client gives date, time and place of birth.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <input
            id={`${idPrefix}-shown`}
            type="checkbox"
            className="mt-1 size-4 accent-gold-700"
            checked={value.active}
            onChange={(e) => set("active", e.target.checked)}
          />
          <div>
            <label htmlFor={`${idPrefix}-shown`} className="block font-semibold text-ink">
              Show on the website
            </label>
            <p className="text-sm text-ink-muted">
              Hidden categories and their plans disappear from the site, but are kept.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminCategories({
  categories,
  max,
  reload,
}: {
  categories: AdminCategory[];
  max: number;
  /** Reloads the list here and wherever else it is used (the plan form). */
  reload: () => Promise<void>;
}) {
  const adminApi = useAdminApi();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Fields>(blankFields);
  const [editing, setEditing] = useState<{ slug: string; fields: Fields } | null>(null);
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const atLimit = categories.length >= max;
  // Unsaved order (slugs, top to bottom), or null when the list is as saved.
  const [order, setOrder] = useState<string[] | null>(null);
  const list: AdminCategory[] = order
    ? [
        ...order.flatMap((s) => categories.filter((c) => c.slug === s)),
        ...categories.filter((c) => !order.includes(c.slug)),
      ]
    : categories;
  const orderChanged = order !== null;
  const waitForOrder = orderChanged ? "Save or cancel the new order first." : undefined;

  // Slide animation when the order changes: each row starts where it was and glides to its
  // new place (measure, then animate the difference). Skipped when the visitor asks for less motion.
  const rows = useRef(new Map<string, HTMLLIElement>());
  const tops = useRef(new Map<string, number>());
  const lastOrder = useRef("");
  const refocus = useRef<{ slug: string; by: -1 | 1 } | null>(null);
  const orderKey = list.map((c) => c.slug).join(",");
  useLayoutEffect(() => {
    const changed = lastOrder.current !== "" && lastOrder.current !== orderKey;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, number>();
    rows.current.forEach((el, slug) => {
      const top = el.offsetTop;
      next.set(slug, top);
      const before = tops.current.get(slug);
      if (changed && !still && before !== undefined && before !== top) {
        el.animate([{ transform: `translateY(${before - top}px)` }, { transform: "translateY(0)" }], {
          duration: 380,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        });
      }
    });
    tops.current = next;
    lastOrder.current = orderKey;
    // Keep focus on the arrow that was pressed (or the other one, once the row reaches an end).
    const f = refocus.current;
    if (changed && f) {
      refocus.current = null;
      const name = list.find((c) => c.slug === f.slug)?.name ?? "";
      const row = rows.current.get(f.slug);
      const same = row?.querySelector<HTMLButtonElement>(
        `button[aria-label="Move ${CSS.escape(name)} ${f.by < 0 ? "up" : "down"}"]`,
      );
      const other = row?.querySelector<HTMLButtonElement>(
        `button[aria-label="Move ${CSS.escape(name)} ${f.by < 0 ? "down" : "up"}"]`,
      );
      (same && !same.disabled ? same : other)?.focus({ preventScroll: true });
    }
  });

  // One place for every change: send, show the answer, reload the list.
  async function change(
    run: () => Promise<{ ok: true; data?: unknown } | { ok: false; error: string }>,
    done: string,
  ) {
    setBusy(true);
    setMsg(null);
    const r = await run();
    setBusy(false);
    if (r.ok) {
      setMsg({ tone: "ok", text: done });
      await reload();
      return true;
    }
    setMsg({ tone: "error", text: r.error });
    return false;
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (busy || !draft.name.trim()) return;
    const ok = await change(async () => {
      const r = await adminApi<{ slug: string }>("/categories", {
        method: "POST",
        json: {
          name: draft.name.trim(),
          description: draft.description.trim(),
          birthDetails: draft.birthDetails,
          active: draft.active,
          ...(draft.code.trim() ? { slug: draft.code.trim() } : {}),
        },
      });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }, `${draft.name.trim()} is added. You can now add plans to it.`);
    if (ok) {
      setDraft(blankFields);
      setAdding(false);
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing || busy || !editing.fields.name.trim()) return;
    const f = editing.fields;
    const ok = await change(async () => {
      const r = await adminApi(`/categories/${editing.slug}`, {
        method: "PUT",
        json: {
          name: f.name.trim(),
          description: f.description.trim(),
          birthDetails: f.birthDetails,
          active: f.active,
        },
      });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }, "Saved.");
    if (ok) setEditing(null);
  }

  async function setShown(c: AdminCategory, active: boolean) {
    await change(
      async () => {
        const r = await adminApi(`/categories/${c.slug}`, {
          method: "PUT",
          json: { name: c.name, description: c.description, birthDetails: c.birthDetails, active },
        });
        return r.ok ? { ok: true } : { ok: false, error: r.error };
      },
      active ? `${c.name} is shown on the website.` : `${c.name} is hidden from the website.`,
    );
  }

  // The arrows change this draft order only. Nothing is saved until "Save order" is pressed.
  function move(index: number, by: -1 | 1) {
    const next = index + by;
    if (next < 0 || next >= list.length) return;
    const slugs = list.map((c) => c.slug);
    [slugs[index], slugs[next]] = [slugs[next]!, slugs[index]!];
    const same = slugs.every((s, i) => s === categories[i]?.slug);
    refocus.current = { slug: list[index]!.slug, by };
    setOrder(same ? null : slugs);
    setMsg(null);
  }

  async function saveOrder() {
    if (!order) return;
    const slugs = list.map((c) => c.slug);
    const ok = await change(async () => {
      const r = await adminApi("/categories/reorder", { method: "POST", json: { slugs } });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }, "Order saved. The Services page follows this order.");
    if (ok) setOrder(null);
  }

  async function remove() {
    if (!deleting) return;
    const c = deleting;
    const ok = await change(async () => {
      const r = await adminApi(`/categories/${c.slug}`, { method: "DELETE" });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }, `${c.name} is deleted.`);
    if (ok) setDeleting(null);
  }

  return (
    <Panel
      title="Categories"
      action={
        <Button
          size="sm"
          variant="outline"
          disabled={atLimit || busy}
          onClick={() => {
            setAdding((v) => !v);
            setMsg(null);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          {adding ? "Close" : "Add category"}
        </Button>
      }
    >
      <p className="mb-5 text-sm text-ink-muted">
        Group your readings however you like, for example Tarot, Astrology, Numerology. Each category has its
        own section on the Services page, in the order you set here. You can have up to {max}.
      </p>

      {adding ? (
        <form onSubmit={add} className="mb-6 space-y-5 rounded-2xl bg-ivory p-5 ring-1 ring-line">
          <h3 className="font-display text-xl text-ink">New category</h3>
          <CategoryFields value={draft} onChange={setDraft} isNew idPrefix="new-cat" />
          <div className="flex gap-3">
            <Button type="submit" disabled={busy || !draft.name.trim()}>
              {busy ? "Saving…" : "Create category"}
            </Button>
            <Button variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {msg ? (
        <div className="mb-5">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      ) : null}

      {categories.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gold-500/60 bg-ivory px-5 py-8 text-center text-ink-muted">
          No categories yet. Add your first one above.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((c, i) => (
            <li
              key={c.slug}
              ref={(el) => {
                if (el) rows.current.set(c.slug, el);
                else rows.current.delete(c.slug);
              }}
              className="relative bg-white py-4"
            >
              {editing?.slug === c.slug ? (
                <form onSubmit={saveEdit} className="space-y-5">
                  <CategoryFields
                    value={editing.fields}
                    onChange={(fields) => setEditing({ slug: c.slug, fields })}
                    isNew={false}
                    idPrefix={`edit-${c.slug}`}
                  />
                  <div className="flex gap-3">
                    <Button type="submit" disabled={busy || !editing.fields.name.trim()}>
                      {busy ? "Saving…" : "Save changes"}
                    </Button>
                    <Button variant="outline" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 sm:flex-1">
                    <p className="font-semibold text-ink">
                      {c.name} {c.active ? <Badge tone="green">Shown</Badge> : <Badge>Hidden</Badge>}{" "}
                      {c.birthDetails ? <Badge tone="gold">Asks birth details</Badge> : null}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {c.planCount === 1 ? "1 plan" : `${c.planCount} plans`}
                      {c.description ? ` · ${c.description}` : ""}
                    </p>
                  </div>
                  {/* Phone: arrows on one row, then Edit, Hide and Delete in three equal columns. */}
                  <div className="grid grid-cols-6 gap-2 sm:flex sm:flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="col-span-3"
                      aria-label={`Move ${c.name} up`}
                      disabled={busy || i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="col-span-3"
                      aria-label={`Move ${c.name} down`}
                      disabled={busy || i === list.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="col-span-2 px-3 sm:px-5"
                      disabled={busy || orderChanged}
                      title={waitForOrder}
                      onClick={() =>
                        setEditing({
                          slug: c.slug,
                          fields: {
                            name: c.name,
                            description: c.description,
                            birthDetails: c.birthDetails,
                            active: c.active,
                            code: "",
                          },
                        })
                      }
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="col-span-2 px-3 sm:px-5"
                      disabled={busy || orderChanged}
                      title={waitForOrder}
                      onClick={() => void setShown(c, !c.active)}
                    >
                      {c.active ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                      {c.active ? "Hide" : "Show"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="col-span-2 px-3 sm:px-5"
                      disabled={busy || orderChanged || c.planCount > 0}
                      title={
                        waitForOrder ??
                        (c.planCount > 0
                          ? "Move or delete its plans first, or hide the category."
                          : undefined)
                      }
                      onClick={() => setDeleting(c)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {orderChanged ? (
        <div className="sticky bottom-3 z-10 mt-4 flex flex-col gap-3 rounded-2xl bg-champagne p-4 shadow-soft ring-1 ring-gold-500/60 sm:flex-row sm:items-center">
          <output className="block text-sm font-semibold text-ink sm:flex-1">
            The order has changed. Save it to update the Services page.
          </output>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setOrder(null)}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void saveOrder()}>
              {busy ? "Saving…" : "Save order"}
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? "this category"}?`}
        word="delete"
        confirmLabel="Delete category"
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      >
        <p>This removes the category from the site and the admin. It can&apos;t be undone.</p>
      </ConfirmDialog>
    </Panel>
  );
}
