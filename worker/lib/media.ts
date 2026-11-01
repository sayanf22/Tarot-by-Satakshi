import type { AppEnv } from "../env";

// Images live in D1 instead of R2 (R2 needs a card on file). Four MEDIA databases
// give 4 × 500 MB = 2 GB. The core database keeps a small index (key → shard), and
// each upload goes to the shard with the most room left.

export const MAX_IMAGE_BYTES = 1_900_000; // D1 allows 2 MB per row
const SHARD_CAP_BYTES = 480 * 1024 * 1024; // leave headroom below 500 MB
export const KEY_PATTERN = /^[A-Za-z0-9_-]{16,40}\.(jpg|png|webp)$/;

export type ImageType = "image/jpeg" | "image/png" | "image/webp";

export function shardDb(env: AppEnv, shard: number): D1Database {
  const dbs = [env.MEDIA_1, env.MEDIA_2, env.MEDIA_3, env.MEDIA_4];
  const db = dbs[shard - 1];
  if (!db) throw new Error("bad shard");
  return db;
}

/** Detects the real image type from its first bytes. SVG and anything else is refused. */
export function sniffImage(bytes: Uint8Array): { type: ImageType; ext: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return { type: "image/png", ext: "png" };
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return { type: "image/webp", ext: "webp" };
  return null;
}

/** The shard with the most free room, or null when all are full. */
export async function pickShard(env: AppEnv, size: number) {
  const { results } = await env.DB.prepare("SELECT shard, sum(size) AS used FROM media GROUP BY shard").all<{
    shard: number;
    used: number;
  }>();
  const used = new Map(results.map((r) => [r.shard, r.used]));
  let best: number | null = null;
  let bestUsed = Infinity;
  for (const shard of [1, 2, 3, 4]) {
    const u = used.get(shard) ?? 0;
    if (u + size <= SHARD_CAP_BYTES && u < bestUsed) {
      best = shard;
      bestUsed = u;
    }
  }
  return best;
}

export async function storageUse(env: AppEnv) {
  const row = await env.DB.prepare(
    "SELECT count(*) AS files, coalesce(sum(size), 0) AS bytes FROM media",
  ).first<{
    files: number;
    bytes: number;
  }>();
  return { files: row?.files ?? 0, bytes: row?.bytes ?? 0, capacity: SHARD_CAP_BYTES * 4 };
}
