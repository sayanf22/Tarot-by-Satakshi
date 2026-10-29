import { Fragment, type CSSProperties } from "react";

/**
 * Wraps each word in a span so headings can animate word by word.
 * `accent` lists word positions (from 0) to set in gold.
 * `start` continues the stagger from an earlier SplitWords in the same heading.
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
      <span
        className={accent.includes(i) ? "w inline-block text-gold-700" : "w inline-block"}
        style={{ "--i": start + i } as CSSProperties}
      >
        {word}
      </span>
      {i < words.length - 1 ? " " : null}
    </Fragment>
  ));
}
