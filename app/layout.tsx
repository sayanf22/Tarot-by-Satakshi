import type { Metadata, Viewport } from "next";
import { EB_Garamond, Figtree } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// The pairing from the reference the user sent (wisprflow.ai): EB Garamond headings and
// Figtree body. Only Medium and heavier weights are loaded (nothing thin), and no italics.
const garamond = EB_Garamond({
  weight: ["500", "600"],
  style: ["normal"],
  subsets: ["latin"],
  variable: "--font-garamond",
  display: "swap",
});

const figtree = Figtree({
  weight: ["500", "600", "700"],
  style: ["normal"],
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Tarot by Satakshi | Tarot & Astrology Readings",
    template: "%s | Tarot by Satakshi",
  },
  description:
    "Book a tarot or astrology reading with Satakshi, on call or text. Monday to Saturday, 11 am to 9 pm IST.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" className={`${garamond.variable} ${figtree.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-gold-foil px-5 py-2 font-bold text-ink shadow-gold focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
        >
          Skip to content
        </a>
        {/* Fine film grain over the whole page. */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70] grain opacity-[0.035]" />
        {children}
      </body>
    </html>
  );
}
