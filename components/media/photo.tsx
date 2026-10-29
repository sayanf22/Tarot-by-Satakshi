import photos from "@/content/photos.json";
import { cn } from "@/lib/cn";

export type PhotoId = keyof typeof photos;

type Props = {
  id: PhotoId;
  /** The `sizes` attribute, so the browser picks the right file. */
  sizes: string;
  className?: string;
  priority?: boolean;
  decorative?: boolean;
};

// Satakshi's photos, pre-sized by scripts/process-photos.mjs.
// The frame always takes the photo's own shape, so nothing is cropped.
export function Photo({ id, sizes, className, priority, decorative }: Props) {
  const p = photos[id];
  return (
    // oxlint-disable-next-line nextjs/no-img-element -- static export: files are pre-resized, next/image can't optimise
    <img
      src={p.sources[1]?.src ?? p.sources[0]!.src}
      srcSet={p.sources.map((s) => `${s.src} ${s.width}w`).join(", ")}
      sizes={sizes}
      width={p.width}
      height={p.height}
      alt={decorative ? "" : p.alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      style={{ aspectRatio: `${p.width} / ${p.height}` }}
      className={cn("block", className)}
    />
  );
}
