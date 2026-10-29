"use client";

import Lenis from "lenis";
import { useEffect } from "react";

// Smooth, eased page scrolling (Lenis). Skipped for visitors who prefer reduced motion.
// Scrolling inside an open <dialog> (the mobile menu) is left native.
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.1,
      anchors: true,
      stopInertiaOnNavigate: true,
      prevent: (node) => node.closest("dialog") !== null,
    });
    return () => lenis.destroy();
  }, []);

  return null;
}
