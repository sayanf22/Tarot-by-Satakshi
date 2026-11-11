"use client";

import { useCallback, useEffect, useId, useState, useSyncExternalStore } from "react";

// Browser-side pause between submissions of a form. It keeps honest visitors from
// double-sending and saves the server some work; the real limits are in the Worker
// (rate-limit bindings and database counters), which no browser setting can change.
//
// With a `storageKey` the pause survives a page refresh (kept in sessionStorage).

const memory = new Map<string, number>();
const listeners = new Set<() => void>();
const storageName = (k: string) => `cooldown:${k}`;
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

function readUntil(name: string, persist: boolean) {
  const mem = memory.get(name) ?? 0;
  if (!persist) return mem;
  try {
    return Math.max(mem, Number(sessionStorage.getItem(storageName(name))) || 0);
  } catch {
    return mem;
  }
}

export function useCooldown(storageKey?: string) {
  const anonymous = useId();
  const name = storageKey ?? anonymous;
  const persist = Boolean(storageKey);
  // Server renders "no pause"; the browser then reads the saved one.
  const until = useSyncExternalStore(
    subscribe,
    () => readUntil(name, persist),
    () => 0,
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [until]);

  const start = useCallback(
    (seconds: number) => {
      const end = Date.now() + seconds * 1000;
      memory.set(name, end);
      if (persist) {
        try {
          sessionStorage.setItem(storageName(name), String(end));
        } catch {}
      }
      setNow(Date.now());
      listeners.forEach((l) => l());
    },
    [name, persist],
  );

  const secondsLeft = Math.max(0, Math.ceil((until - now) / 1000));
  return { secondsLeft, active: secondsLeft > 0, start };
}
