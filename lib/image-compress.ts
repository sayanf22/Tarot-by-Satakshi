// Shrinks an image in the browser before it is uploaded from the admin.
// - Photos are re-encoded as WebP at quality 0.9, which looks the same as the
//   original to the eye (no visible loss) and is usually 60–90% smaller.
// - PNG graphics (logos, text) are tried lossless as well and the smaller wins.
// - Very large photos are scaled so the longest side is at most 2400 px, which is
//   still sharp on a 4K screen. Nothing is cropped.
// - The camera's rotation is applied, and all metadata (GPS location, camera model)
//   is dropped, since only pixels are redrawn.
// - Browsers that can't make WebP (older Safari) fall back to JPEG at quality 0.9.

const MAX_SIDE = 2400;
const MAX_BYTES = 1_900_000; // one database row holds 2 MB
const QUALITIES = [0.9, 0.86, 0.82, 0.78];

export type Compressed = {
  blob: Blob;
  type: "image/webp" | "image/jpeg" | "image/png";
  width: number;
  height: number;
};

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Draws with step-down halving, which keeps fine detail sharper than one big resize. */
function draw(bitmap: ImageBitmap, width: number, height: number) {
  let src: CanvasImageSource = bitmap;
  let w = bitmap.width;
  let h = bitmap.height;
  while (w / 2 >= width && h / 2 >= height) {
    const step = document.createElement("canvas");
    step.width = Math.round(w / 2);
    step.height = Math.round(h / 2);
    const ctx = step.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, step.width, step.height);
    src = step;
    w = step.width;
    h = step.height;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, width, height);
  return canvas;
}

export async function compressImage(file: File): Promise<Compressed> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    let scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 4; attempt++) {
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = draw(bitmap, width, height);

      const candidates: Blob[] = [];
      for (const q of QUALITIES) {
        const webp = await encode(canvas, "image/webp", q);
        if (webp?.type === "image/webp") {
          if (webp.size <= MAX_BYTES) {
            candidates.push(webp);
            break;
          }
        } else {
          const jpeg = await encode(canvas, "image/jpeg", q);
          if (jpeg && jpeg.size <= MAX_BYTES) {
            candidates.push(jpeg);
            break;
          }
        }
      }
      if (file.type === "image/png") {
        const lossless = await encode(canvas, "image/webp", 1);
        if (lossless?.type === "image/webp" && lossless.size <= MAX_BYTES) candidates.push(lossless);
      }
      if (candidates.length) {
        // Prefer lossless when it costs at most 30% more than lossy.
        candidates.sort((a, b) => a.size - b.size);
        const best =
          candidates.length > 1 && candidates[1]!.size <= candidates[0]!.size * 1.3
            ? candidates[1]!
            : candidates[0]!;
        return { blob: best, type: best.type as Compressed["type"], width, height };
      }
      scale *= 0.8; // still too big: make it a little smaller and try again
    }
    throw new Error("too big");
  } finally {
    bitmap.close();
  }
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1_048_576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1_048_576).toFixed(1)} MB`;
}
