"use client";

import { createContext, useContext, type ReactNode } from "react";
import { api, type ApiResult } from "@/lib/api";
import { cn } from "@/lib/cn";

// Shared pieces for the admin screens.

/** Calls /api/admin/*; a 401 sends the admin back to the sign-in screen. */
export const SignOutContext = createContext<() => void>(() => {});

export function useAdminApi() {
  const signedOut = useContext(SignOutContext);
  return async function adminApi<T>(
    path: string,
    init: Parameters<typeof api>[1] = {},
  ): Promise<ApiResult<T>> {
    const r = await api<T>(`/api/admin${path}`, init);
    if (!r.ok && r.status === 401) signedOut();
    return r;
  };
}

export const IST = "Asia/Kolkata";

export function when(ms: number, withTime = true) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(ms);
}

export function rupees(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[28px] bg-white p-5 shadow-soft ring-1 ring-line sm:p-7", className)}>
      {title || action ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          {title ? <h2 className="font-display text-2xl text-ink">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

const tones = {
  gold: "bg-champagne text-gold-800",
  green: "bg-[#e6f2e8] text-[#25603a]",
  grey: "bg-[#efece6] text-ink-muted",
  red: "bg-[#f6e3e3] text-danger",
} as const;

export function Badge({ tone = "grey", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): keyof typeof tones {
  if (status === "confirmed" || status === "paid") return "green";
  if (status === "held" || status === "created" || status === "refund_pending") return "gold";
  if (status === "refunded" || status === "failed") return "red";
  return "grey";
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "ok"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-2xl px-4 py-3 text-sm",
        tone === "error" && "border border-danger/30 bg-white text-danger",
        tone === "ok" && "bg-[#e6f2e8] text-[#25603a]",
        tone === "info" && "bg-ivory text-ink",
      )}
    >
      {children}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-gold-500/60 bg-ivory px-5 py-8 text-center text-ink-muted">
      {children}
    </p>
  );
}
