"use client";

import { Copy, ImagePlus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { compressImage, formatBytes } from "@/lib/image-compress";
import { Empty, Notice, PageTitle, Panel, useAdminApi } from "./shared";

type Media = { key: string; content_type: string; size: number; alt: string; created_at: number };
type Storage = { files: number; bytes: number; capacity: number };
type Result = {
  name: string;
  before: number;
  after: number;
  ok: boolean;
  error?: string;
  duplicate?: boolean;
};

export function AdminImages() {
  const adminApi = useAdminApi();
  const [items, setItems] = useState<Media[] | null>(null);
  const [storage, setStorage] = useState<Storage | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await adminApi<{ media: Media[]; storage: Storage }>("/media");
    if (r.ok) {
      setItems(r.data.media);
      setStorage(r.data.storage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => void load(), [load]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setMsg(null);
    const done: Result[] = [];
    const list = Array.from(files).slice(0, 20);
    for (const [i, file] of list.entries()) {
      setProgress(`Compressing and uploading ${i + 1} of ${list.length}…`);
      if (!/^image\/(jpeg|png|webp|heic|heif|avif|gif)$/.test(file.type)) {
        done.push({ name: file.name, before: file.size, after: 0, ok: false, error: "not a photo" });
        continue;
      }
      try {
        const c = await compressImage(file);
        const r = await adminApi<{ key: string; duplicate?: boolean }>(
          `/media?alt=${encodeURIComponent(file.name.replace(/\.[^.]+$/, "").slice(0, 120))}`,
          {
            method: "POST",
            body: c.blob,
            headers: { "Content-Type": c.type },
          },
        );
        done.push(
          r.ok
            ? {
                name: file.name,
                before: file.size,
                after: c.blob.size,
                ok: true,
                duplicate: r.data.duplicate,
              }
            : { name: file.name, before: file.size, after: 0, ok: false, error: r.error },
        );
      } catch {
        done.push({
          name: file.name,
          before: file.size,
          after: 0,
          ok: false,
          error: "this browser couldn't read it; try a JPEG or PNG",
        });
      }
    }
    setProgress(null);
    setResults(done);
    if (input.current) input.current.value = "";
    await load();
  }

  async function remove(m: Media) {
    if (!confirm(`Delete "${m.alt || m.key}"?`)) return;
    const r = await adminApi(`/media/${m.key}`, { method: "DELETE" });
    setMsg(r.ok ? { tone: "ok", text: "Image deleted." } : { tone: "error", text: r.error });
    await load();
  }

  async function copy(m: Media) {
    await navigator.clipboard.writeText(`${location.origin}/media/${m.key}`).catch(() => {});
    setMsg({ tone: "ok", text: "Link copied." });
  }

  const saved = results.filter((r) => r.ok);
  const before = saved.reduce((a, r) => a + r.before, 0);
  const after = saved.reduce((a, r) => a + r.after, 0);

  return (
    <>
      <PageTitle
        title="Images"
        action={
          <label className="inline-flex">
            <input
              ref={input}
              type="file"
              accept="image/*"
              multiple
              className="peer sr-only"
              onChange={(e) => void upload(e.target.files)}
              disabled={Boolean(progress)}
            />
            <span className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-gold-foil px-5 text-sm font-bold text-ink shadow-gold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-700 peer-disabled:opacity-60">
              <ImagePlus className="size-4" aria-hidden="true" />
              {progress ? "Uploading…" : "Upload images"}
            </span>
          </label>
        }
      />
      <p className="text-sm text-ink-muted">
        Photos are compressed in your browser before upload: sharp at full size, with location data removed.
        Up to 20 at a time.
        {storage
          ? ` ${storage.files} images · ${formatBytes(storage.bytes)} used of ${Math.round(storage.capacity / 1_073_741_824)} GB.`
          : ""}
      </p>
      {progress ? <Notice>{progress}</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {results.length ? (
        <Panel title="Last upload">
          <ul className="space-y-2 text-sm">
            {results.map((r) => (
              <li key={r.name} className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                <span className="min-w-0 truncate font-semibold text-ink">{r.name}</span>
                {r.ok && r.duplicate ? (
                  <span className="text-ink-muted">Already saved, so it wasn't stored again</span>
                ) : r.ok ? (
                  <span className="text-ink-muted tabular">
                    {formatBytes(r.before)} → {formatBytes(r.after)} (
                    {Math.max(0, Math.round((1 - r.after / r.before) * 100))}% smaller)
                  </span>
                ) : (
                  <span className="text-danger">Not uploaded: {r.error}</span>
                )}
              </li>
            ))}
          </ul>
          {saved.length > 1 ? (
            <p className="mt-3 text-sm font-semibold text-ink">
              Total {formatBytes(before)} → {formatBytes(after)}
            </p>
          ) : null}
        </Panel>
      ) : null}
      <Panel>
        {!items ? (
          <p className="text-ink-muted">Loading…</p>
        ) : items.length === 0 ? (
          <Empty>No images yet. Upload photos to use them on plans.</Empty>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
            {items.map((m) => (
              <li key={m.key} className="min-w-0 overflow-hidden rounded-2xl bg-white ring-1 ring-line">
                {/* Shown whole (object-contain), never cropped. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/media/${m.key}`}
                  alt={m.alt}
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full bg-ivory object-contain"
                />
                <div className="space-y-2 p-3">
                  <p className="truncate text-xs font-semibold text-ink" title={m.alt}>
                    {m.alt || "Untitled"}
                  </p>
                  <p className="text-xs text-ink-muted tabular">{formatBytes(m.size)}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 flex-1 px-0"
                      aria-label={`Copy link to ${m.alt || "image"}`}
                      onClick={() => void copy(m)}
                    >
                      <Copy className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 flex-1 px-0"
                      aria-label={`Delete ${m.alt || "image"}`}
                      onClick={() => void remove(m)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
