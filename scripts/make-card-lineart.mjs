// Turns the public-domain Rider–Waite–Smith card images into gold line art for the
// card fronts, like the engraved illustrations in the client's "Offerings" reference.
// Input: public/images/tarot/<id>-560.webp (from fetch-tarot-cards.mjs).
// Output: public/images/tarot/<id>-line.webp (gold lines on transparent) and a
// `line` entry per card in content/tarot-cards.json.
// Run: node scripts/make-card-lineart.mjs
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const GOLD = [0x8f, 0x65, 0x14]; // gold-700 (#8f6514)
const OUT_WIDTH = 480;
// Inside the card frame: skips the white border, the numeral at the top (the site shows
// icons, not numbers) and the title band at the bottom.
const CROP = { left: 0.06, right: 0.06, top: 0.07, bottom: 0.155 };
// Grey levels: darker than DARK is a full line, lighter than LIGHT is empty.
const DARK = 55;
const LIGHT = 135;
// Soft fade at the crop edges, as a fraction of each side.
const FADE = 0.08;

const manifestPath = "content/tarot-cards.json";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

for (const [id, card] of Object.entries(manifest)) {
  const src = `public/images/tarot/${id}-560.webp`;
  const meta = await sharp(src).metadata();
  const left = Math.round(meta.width * CROP.left);
  const top = Math.round(meta.height * CROP.top);
  const width = Math.round(meta.width * (1 - CROP.left - CROP.right));
  const height = Math.round(meta.height * (1 - CROP.top - CROP.bottom));

  const { data, info } = await sharp(src)
    .extract({ left, top, width, height })
    .resize({ width: OUT_WIDTH })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = data[(y * w + x) * ch];
      let a = v <= DARK ? 255 : v >= LIGHT ? 0 : ((LIGHT - v) * 255) / (LIGHT - DARK);
      // Fade out towards the edges so the crop has no hard line.
      const ex = Math.min(x / w, (w - 1 - x) / w) / FADE;
      const ey = Math.min(y / h, (h - 1 - y) / h) / FADE;
      a *= Math.min(1, ex) * Math.min(1, ey);
      const o = (y * w + x) * 4;
      rgba[o] = GOLD[0];
      rgba[o + 1] = GOLD[1];
      rgba[o + 2] = GOLD[2];
      rgba[o + 3] = Math.round(a);
    }
  }

  const file = `${id}-line.webp`;
  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .webp({ quality: 88, alphaQuality: 90, effort: 6 })
    .toFile(`public/images/tarot/${file}`);
  card.line = { src: `/images/tarot/${file}`, width: w, height: h };
  console.log(`${id}: line art ${w}x${h}`);
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log("Updated content/tarot-cards.json");
