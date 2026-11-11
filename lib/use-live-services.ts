"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Service } from "@/lib/types";

type Live = { services: readonly Service[]; homeCards: number };

// One request per page view, shared by every section that needs the plan list.
let pending: Promise<Live | null> | null = null;

function loadLive() {
  pending ??= api<{ services: Service[]; homeCards: number }>("/api/services").then((r) =>
    r.ok && Array.isArray(r.data.services)
      ? { services: r.data.services, homeCards: r.data.homeCards }
      : null,
  );
  return pending;
}

/**
 * The plans as saved in the admin right now. The page first shows the list it was built
 * with, then swaps in the live list, so a plan added, changed or hidden in the admin shows
 * on the next page load without waiting for a rebuild.
 */
export function useLiveServices(built: readonly Service[], builtHomeCards = 6) {
  const [live, setLive] = useState<Live>({ services: built, homeCards: builtHomeCards });
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    let alive = true;
    void loadLive().then((data) => {
      if (!alive) return;
      if (data) setLive(data);
      setChecked(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return { ...live, checked };
}
