import { Fragment, type CSSProperties } from "react";

/**
 * Wraps each word in a span so headings can animate word by word.
 * Each word sits in a clipping mask (`.wm`), so it rises into view from below its line.
 * `accent` lists word positions (from 0) to set in gold.
 * `start` continues the stagger from an earlier SplitWords in the same block.
 */
export function SplitWords({
  text,
  accent = [],
  start = 0,
}: {
  text: string;
  accent?: number[];
  start?: number;
}) {
  const words = text.split(" ");
  return words.map((word, i) => (
    <Fragment key={`${word}-${i}`}>
      <span className="wm">
        <span
          className={accent.includes(i) ? "w inline-block text-gold-700" : "w inline-block"}
          style={{ "--i": start + i } as CSSProperties}
        >
          {word}
        </span>
      </span>
      {i < words.length - 1 ? " " : null}
    </Fragment>
  ));
}
