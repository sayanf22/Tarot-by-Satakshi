// Works around a Next.js 16 static-export bug on Windows (vercel/next.js#85374).
// The export names segment prefetch files with path.relative(), which uses "\" on
// Windows, so "__next.about.__PAGE__.txt" is written as "__next.about/__PAGE__.txt"
// and every <Link> prefetch 404s. This moves those files back to the flat names the
// router requests. On Linux (including Cloudflare Workers Builds) there is nothing to move.
import { readdir, rename, rm, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const OUT = "out";

async function filesUnder(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) => (e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)])),
  );
  return nested.flat();
}

async function walk(dir, moved) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = join(dir, entry.name);
    if (entry.name.startsWith("__next.")) {
      for (const file of await filesUnder(full)) {
        const flat = `${entry.name}.${relative(full, file).split(sep).join(".")}`;
        await rename(file, join(dir, flat));
        moved.push(join(dir, flat));
      }
      await rm(full, { recursive: true, force: true });
    } else {
      await walk(full, moved);
    }
  }
}

try {
  await stat(OUT);
} catch {
  console.error(`fix-export-segments: "${OUT}" not found; run next build first.`);
  process.exit(1);
}

const moved = [];
await walk(OUT, moved);
console.log(
  moved.length
    ? `fix-export-segments: moved ${moved.length} segment file(s) to their flat names.`
    : "fix-export-segments: nothing to fix.",
);
