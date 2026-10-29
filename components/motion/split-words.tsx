import { Fragment, type CSSProperties } from "react";

/**
 * Wraps each word in a span so headings can animate word by word.
 * `accent` lists word positions (from 0) to set in the theme purple.
 */
export function SplitWords({ text, accent = [] }: { text: string; accent?: number[] }) {
  const words = text.split(" ");
  return words.map((word, i) => (
    <Fragment key={`${word}-${i}`}>
      <span
        className={accent.includes(i) ? "w inline-block text-gold-700" : "w inline-block"}
        style={{ "--i": i } as CSSProperties}
      >
        {word}
      </span>
      {i < words.length - 1 ? " " : null}
    </Fragment>
  ));
}
