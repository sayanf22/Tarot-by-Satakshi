"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Empty, Notice, Panel, useAdminApi } from "./shared";

type Media = { key: string; content_type: string; size: number; alt: string; created_at: number };
type Storage = { files: number; bytes: number; capacity: number };

const MAX_SIDE = 1800;
const MAX_BYTES = 1_900_000;

/**
 * Resizes a photo in the browser to WebP (longest side 1800 px) before upload,
 * so it fits one database row and loads fast. The whole photo is kept: nothing is cropped.
 */
async function prepare(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.86, 0.78, 0.7, 0.6]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  throw new Error("too big");
}

export function AdminImages() {
  const adminApi = useAdminApi();
  const [items, setItems] = useState<Media[] | null>(null);
  const [storage, setStorage] = useState<Storage | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    setMsg(null);
    let done = 0;
    for (const file of Array.from(files)) {
      try {
        const blob = await prepare(file);
        const r = await adminApi<{ key: string }>(
          `/media?alt=${encodeURIComponent(file.name.replace(/\.[^.]+$/, ""))}`,
          {
            method: "POST",
            body: blob,
            headers: { "Content-Type": "image/webp" },
          },
        );
        if (!r.ok) throw new Error(r.error);
        done++;
      } catch (err) {
        setMsg({
          tone: "error",
          text: `${file.name}: ${err instanceof Error && err.message !== "too big" ? err.message : "couldn't be prepared. Try a JPEG or PNG."}`,
        });
      }
    }
    setBusy(false);
    if (done) setMsg({ tone: "ok", text: `${done} image${done > 1 ? "s" : ""} uploaded.` });
    if (input.current) input.current.value = "";
    await load();
  }

  async function remove(key: string) {
    if (!confirm("Delete this image?")) return;
    const r = await adminApi(`/media/${key}`, { method: "DELETE" });
    setMsg(r.ok ? { tone: "ok", text: "Deleted." } : { tone: "error", text: r.error });
    await load();
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl">Images</h1>
        <label className="inline-flex">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => void upload(e.target.files)}
            disabled={busy}
          />
          <span className="inline-flex h-12 cursor-pointer items-center rounded-full bg-gold-foil px-7 font-bold text-ink shadow-gold">
            {busy ? "Uploading…" : "Upload images"}
          </span>
        </label>
      </div>
      {storage ? (
        <p className="text-sm text-ink-muted">
          {storage.files} images · {(storage.bytes / 1_048_576).toFixed(1)} MB used of{" "}
          {Math.round(storage.capacity / 1_073_741_824)} GB
        </p>
      ) : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Panel>
        {!items ? (
          <p className="text-ink-muted">Loading…</p>
        ) : items.length === 0 ? (
          <Empty>No images yet. Upload photos to use them on plans.</Empty>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((m) => (
              <li key={m.key} className="overflow-hidden rounded-2xl ring-1 ring-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/media/${m.key}`}
                  alt={m.alt}
                  loading="lazy"
                  className="aspect-square w-full bg-ivory object-contain"
                />
                <div className="space-y-2 p-3">
                  <p className="truncate text-xs text-ink-muted">{m.alt || m.key}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void navigator.clipboard.writeText(`${location.origin}/media/${m.key}`)}
                    >
                      Copy link
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void remove(m.key)}>
                      Delete
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
