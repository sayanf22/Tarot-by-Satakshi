// Makes the share preview (public/og.jpg, 1200 × 630) and the app icons
// (public/apple-icon.png 180 × 180, public/favicon.ico 48 × 48) once; the files are committed.
// The share image uses the site's own fonts, gold and Satakshi's portrait (never cropped).
// Run: node scripts/make-og.mjs   (needs internet once, for the Google Fonts files)
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const portrait = await readFile("public/images/satakshi-portrait-800.webp");
const photo = `data:image/webp;base64,${portrait.toString("base64")}`;
const mark = await readFile("app/icon.svg", "utf8");

const html = `<!doctype html><html><head>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@500;600&family=Figtree:wght@600;700&display=block" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;background:#fff;font-family:Figtree,sans-serif;color:#1c1712;overflow:hidden}
  .wrap{position:absolute;inset:22px;border-radius:40px;border:2px solid #d4a542;
    background:radial-gradient(circle at 12% 0%,#f7edd3 0,#fff 55%);display:flex;align-items:center;gap:56px;padding:0 64px}
  .text{flex:1}
  .mark{width:72px;height:72px}
  .eyebrow{margin-top:26px;font-weight:700;letter-spacing:.32em;font-size:20px;color:#73500e}
  h1{margin-top:10px;font-family:'EB Garamond',serif;font-weight:600;font-size:92px;line-height:.98;
    background:linear-gradient(100deg,#73500e,#a87a1c 40%,#8f6514 70%,#73500e);-webkit-background-clip:text;color:transparent}
  .line{margin-top:22px;font-size:30px;font-weight:600;color:#3b3127}
  .meta{margin-top:16px;font-size:22px;font-weight:600;color:#6b5d4f}
  .url{margin-top:34px;display:inline-block;padding:12px 26px;border-radius:999px;font-weight:700;font-size:22px;
    background:linear-gradient(100deg,#f3dc9c,#d4a542 50%,#c4922c);color:#1c1712}
  .frame{background:#17120d;padding:12px;border-radius:30px;box-shadow:0 24px 60px -20px rgba(60,40,10,.45)}
  .frame img{display:block;height:520px;width:auto;border-radius:22px}
</style></head><body>
<div class="wrap">
  <div class="text">
    <div class="mark">${mark}</div>
    <p class="eyebrow">TAROT BY</p>
    <h1>Satakshi</h1>
    <p class="line">Tarot &amp; astrology readings</p>
    <p class="meta">On a call or over text · Mon – Sat, 11 am – 9 pm IST</p>
    <span class="url">guidancebysatakshi.com</span>
  </div>
  <div class="frame"><img src="${photo}" alt=""></div>
</div></body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: "png" });
  // JPEG keeps it small (WhatsApp skips large previews).
  await writeFile("public/og.jpg", await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toBuffer());
} finally {
  await browser.close();
}

// Icons from the site's mark.
await sharp(Buffer.from(mark)).resize(180, 180).png().toFile("public/apple-icon.png");
const ico48 = await sharp(Buffer.from(mark)).resize(48, 48).png().toBuffer();
// A .ico file can hold a PNG directly: 6-byte header, one 16-byte entry, then the PNG.
const head = Buffer.alloc(22);
head.writeUInt16LE(0, 0);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(1, 4);
head.writeUInt8(48, 6);
head.writeUInt8(48, 7);
head.writeUInt16LE(1, 10);
head.writeUInt16LE(32, 12);
head.writeUInt32LE(ico48.length, 14);
head.writeUInt32LE(22, 18);
await writeFile("public/favicon.ico", Buffer.concat([head, ico48]));
console.log("wrote public/og.jpg, public/apple-icon.png, public/favicon.ico");
