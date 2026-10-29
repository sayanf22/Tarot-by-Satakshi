// Downloads public-domain Rider–Waite–Smith tarot cards (Pamela Colman Smith, 1909)
// from Wikimedia Commons and saves web-ready WebP files in public/images/tarot.
// Each file's licence is checked against the Commons API before it is saved.
// Writes content/tarot-cards.json with sizes, titles and source pages.
// Run: node scripts/fetch-tarot-cards.mjs
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

// Only fully clothed figures: The Star, The Sun and The Lovers in this deck show nudity,
// which doesn't suit a client's booking site.
const cards = [
  { id: "moon", file: "RWS Tarot 18 Moon.jpg", name: "The Moon", numeral: "XVIII" },
  { id: "priestess", file: "RWS Tarot 02 High Priestess.jpg", name: "The High Priestess", numeral: "II" },
  { id: "two-cups", file: "Cups02.jpg", name: "Two of Cups", numeral: "" },
  { id: "ace-pentacles", file: "Pents01.jpg", name: "Ace of Pentacles", numeral: "" },
  { id: "wheel", file: "RWS Tarot 10 Wheel of Fortune.jpg", name: "Wheel of Fortune", numeral: "X" },
  { id: "hermit", file: "RWS Tarot 09 Hermit.jpg", name: "The Hermit", numeral: "IX" },
];

const UA = { "User-Agent": "WhyCreatives-site-build/1.0 (hello@whycreatives.in)" };
// Cards show at up to ~280 px wide, so 560 px covers 2x screens.
const widths = [280, 560];

const titles = cards.map((c) => `File:${c.file}`).join("|");
const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size|extmetadata&titles=${encodeURIComponent(titles)}`;
const res = await fetch(api, { headers: UA });
if (!res.ok) throw new Error(`Commons API ${res.status}`);
const pages = Object.values((await res.json()).query.pages);

await mkdir("public/images/tarot", { recursive: true });
const manifest = {};

for (const card of cards) {
  const page = pages.find((p) => p.title === `File:${card.file}`);
  const info = page?.imageinfo?.[0];
  if (!info) throw new Error(`Not found on Commons: ${card.file}`);
  const licence = info.extmetadata?.LicenseShortName?.value ?? "";
  if (!/public domain/i.test(licence)) throw new Error(`${card.file} is "${licence}", not public domain`);

  const img = await fetch(info.url, { headers: UA });
  if (!img.ok) throw new Error(`Download ${img.status}: ${card.file}`);
  const buf = Buffer.from(await img.arrayBuffer());

  const sources = [];
  let height = 0;
  for (const w of widths) {
    const file = `${card.id}-${w}.webp`;
    const out = await sharp(buf)
      .resize({ width: w })
      .webp({ quality: 72, effort: 6 })
      .toFile(`public/images/tarot/${file}`);
    height = out.height;
    sources.push({ src: `/images/tarot/${file}`, width: w });
  }
  manifest[card.id] = {
    name: card.name,
    numeral: card.numeral,
    width: widths.at(-1),
    height,
    sources,
    source: info.descriptionurl,
    licence,
  };
  console.log(`${card.id}: ${licence}, ${info.width}x${info.height} -> ${widths.join("/")} px`);
}

await writeFile("content/tarot-cards.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log("Wrote content/tarot-cards.json");
