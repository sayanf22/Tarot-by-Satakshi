// Turns Satakshi's original photos (image/, never deployed) into web-ready WebP files
// in public/images, and writes their sizes to content/photos.json.
// - Crops off the bottom strip with the phone's "vivo V29 Pro" watermark and date.
// - sharp drops all metadata by default, so camera details and GPS location are removed.
// Run: node scripts/process-photos.mjs
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

// Crop bands are fractions of the original height. Faces stay well inside the kept area.
const photos = [
  {
    id: "portrait",
    src: "image/IMG-20260922-WA0100.jpg.jpeg",
    alt: "Satakshi Kapoor smiling, in a white collared top",
    top: 0.04,
    bottom: 0.76,
  },
  {
    id: "terrace",
    src: "image/IMG-20260922-WA0106.jpg.jpeg",
    alt: "Satakshi Kapoor seated on a terrace with hills behind her",
    top: 0,
    bottom: 0.92,
  },
  // Awards and features she sent (18 Nov 2026). Shown whole: no crop.
  // The HERstory Times file was a video; this is a still of its final frame (no video on the site).
  {
    id: "awardHerstory",
    src: "image/award-herstory-2024.png",
    alt: "HERstory Times Inspiration Awards 2024 card: Satakshi Kapoor, Tarot and Akashic Record Reader",
    top: 0,
    bottom: 1,
  },
  {
    id: "featureGlorious",
    src: "image/award-glorious-feature.jpeg",
    alt: "Glorious magazine page on Satakshi Kapoor, titled A Journey into the Mystical Arts",
    top: 0,
    bottom: 1,
  },
];

const widths = [480, 800, 1200];
await mkdir("public/images", { recursive: true });
const manifest = {};

for (const p of photos) {
  const meta = await sharp(p.src).metadata();
  const top = Math.round(meta.height * p.top);
  const height = Math.round(meta.height * (p.bottom - p.top));
  const sources = [];
  // Never enlarge: sizes above the original are replaced by the original width.
  const sizes = [...new Set(widths.map((w) => Math.min(w, meta.width)))];
  for (const w of sizes) {
    const slug = p.id.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    const file = `satakshi-${slug}-${w}.webp`;
    await sharp(p.src)
      .rotate()
      .extract({ left: 0, top, width: meta.width, height })
      .resize({ width: w })
      .webp({ quality: 80 })
      .toFile(`public/images/${file}`);
    sources.push({ src: `/images/${file}`, width: w });
  }
  manifest[p.id] = { alt: p.alt, width: meta.width, height, sources };
  console.log(`${p.id}: ${meta.width}x${height} (ratio ${(meta.width / height).toFixed(3)})`);
}

await writeFile("content/photos.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log("Wrote content/photos.json");
