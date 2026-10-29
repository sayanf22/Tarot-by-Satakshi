"use client";

import { useState, type PointerEvent } from "react";

// Tracks which card a mouse is over, so a card can turn while hovered.
// Touch and pen are ignored: on phones cards turn by tapping instead.
export function useHoverTurn<T extends string | number>() {
  const [hovered, setHovered] = useState<T | null>(null);

  const bind = (id: T) => ({
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType === "mouse") setHovered(id);
    },
    onPointerLeave: (e: PointerEvent) => {
      if (e.pointerType === "mouse") setHovered((h) => (h === id ? null : h));
    },
  });

  return { hovered, bind };
}
