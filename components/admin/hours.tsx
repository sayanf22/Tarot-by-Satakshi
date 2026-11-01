"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { Empty, Notice, PageTitle, Panel, useAdminApi } from "./shared";

type Rule = { weekday: number; enabled: number; open_min: number; close_min: number };
type Override = {
  date: string;
  closed: number;
  open_min: number | null;
  close_min: number | null;
  note: string | null;
};
type Setting = { key: string; value: string };

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const toTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export function AdminHours() {
  const adminApi = useAdminApi();
  const [rules, setRules] = useState<Rule[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [off, setOff] = useState({ date: "", closed: true, open: "11:00", close: "21:00", note: "" });

  const load = useCallback(async () => {
    const r = await adminApi<{ rules: Rule[]; overrides: Override[]; settings: Setting[] }>("/availability");
    if (r.ok) {
      setRules(r.data.rules);
      setOverrides(r.data.overrides);
      setSettings(Object.fromEntries(r.data.settings.map((s) => [s.key, s.value])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => void load(), [load]);

  const say = (ok: boolean, error = "") =>
    setMsg(ok ? { tone: "ok", text: "Saved." } : { tone: "error", text: error });

  async function saveRules() {
    const r = await adminApi("/availability/rules", {
      method: "PUT",
      json: rules.map((x) => ({
        weekday: x.weekday,
        enabled: x.enabled === 1,
        openMin: x.open_min,
        closeMin: x.close_min,
      })),
    });
    say(r.ok, r.ok ? "" : r.error);
  }

  async function addOff() {
    if (!off.date) return setMsg({ tone: "error", text: "Choose a date." });
    const r = await adminApi(`/availability/overrides/${off.date}`, {
      method: "PUT",
      json: {
        closed: off.closed,
        openMin: off.closed ? null : toMin(off.open),
        closeMin: off.closed ? null : toMin(off.close),
        note: off.note,
      },
    });
    say(r.ok, r.ok ? "" : r.error);
    if (r.ok) {
      setOff({ ...off, date: "", note: "" });
      await load();
    }
  }

  async function removeOff(date: string) {
    const r = await adminApi(`/availability/overrides/${date}`, { method: "DELETE" });
    say(r.ok, r.ok ? "" : r.error);
    await load();
  }

  async function saveSettings() {
    const r = await adminApi("/settings", {
      method: "PUT",
      json: {
        slot_minutes: Number(settings.slot_minutes),
        min_notice_minutes: Number(settings.min_notice_minutes),
        window_days: Number(settings.window_days),
        hold_minutes: Number(settings.hold_minutes),
      },
    });
    say(r.ok, r.ok ? "" : r.error);
  }

  return (
    <>
      <PageTitle title="Hours" />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}

      <Panel
        title="Weekly hours (IST)"
        action={
          <Button size="sm" onClick={() => void saveRules()}>
            Save hours
          </Button>
        }
      >
        <ul className="divide-y divide-line">
          {rules.map((r, i) => (
            <li key={r.weekday} className="flex flex-wrap items-center gap-4 py-3">
              <label className="flex w-36 items-center gap-3 font-semibold">
                <input
                  type="checkbox"
                  className="size-4 accent-gold-700"
                  checked={r.enabled === 1}
                  onChange={(e) =>
                    setRules(rules.map((x, j) => (j === i ? { ...x, enabled: e.target.checked ? 1 : 0 } : x)))
                  }
                />
                {days[r.weekday]}
              </label>
              {r.enabled ? (
                <span className="flex items-center gap-2">
                  <input
                    type="time"
                    aria-label={`${days[r.weekday]} opens`}
                    className="rounded-xl border border-line px-3 py-2"
                    value={toTime(r.open_min)}
                    onChange={(e) =>
                      setRules(rules.map((x, j) => (j === i ? { ...x, open_min: toMin(e.target.value) } : x)))
                    }
                  />
                  to
                  <input
                    type="time"
                    aria-label={`${days[r.weekday]} closes`}
                    className="rounded-xl border border-line px-3 py-2"
                    value={toTime(r.close_min)}
                    onChange={(e) =>
                      setRules(
                        rules.map((x, j) => (j === i ? { ...x, close_min: toMin(e.target.value) } : x)),
                      )
                    }
                  />
                </span>
              ) : (
                <span className="text-ink-muted">Closed</span>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Days off and special hours">
        <div className="grid gap-4 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end">
          <Field id="o-date" label="Date">
            <TextInput
              id="o-date"
              type="date"
              value={off.date}
              onChange={(e) => setOff({ ...off, date: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 pb-3">
            <input
              type="checkbox"
              className="size-4 accent-gold-700"
              checked={off.closed}
              onChange={(e) => setOff({ ...off, closed: e.target.checked })}
            />{" "}
            Closed all day
          </label>
          {off.closed ? (
            <Field id="o-note" label="Note" optional>
              <TextInput
                id="o-note"
                maxLength={120}
                value={off.note}
                onChange={(e) => setOff({ ...off, note: e.target.value })}
              />
            </Field>
          ) : (
            <span className="flex items-center gap-2 pb-2">
              <input
                type="time"
                aria-label="Opens"
                className="rounded-xl border border-line px-3 py-2"
                value={off.open}
                onChange={(e) => setOff({ ...off, open: e.target.value })}
              />
              to
              <input
                type="time"
                aria-label="Closes"
                className="rounded-xl border border-line px-3 py-2"
                value={off.close}
                onChange={(e) => setOff({ ...off, close: e.target.value })}
              />
            </span>
          )}
          <Button onClick={() => void addOff()}>Add</Button>
        </div>
        <div className="mt-6">
          {overrides.length === 0 ? (
            <Empty>No days off coming up.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {overrides.map((o) => (
                <li key={o.date} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="font-semibold tabular">{o.date}</span>
                  <span className="text-ink-muted">
                    {o.closed ? "Closed" : `${toTime(o.open_min ?? 0)} to ${toTime(o.close_min ?? 0)}`}
                    {o.note ? ` · ${o.note}` : ""}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => void removeOff(o.date)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <Panel
        title="Booking rules"
        action={
          <Button size="sm" onClick={() => void saveSettings()}>
            Save rules
          </Button>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {[
            ["slot_minutes", "Start times every (minutes)", "Multiples of 15."],
            ["min_notice_minutes", "Minimum notice (minutes)", "How soon before a session it can be booked."],
            ["window_days", "Book up to (days ahead)", ""],
            ["hold_minutes", "Hold a time while paying (minutes)", "5 to 30."],
          ].map(([key, label, hint]) => (
            <Field key={key} id={`s-${key}`} label={label!} hint={hint || undefined}>
              <TextInput
                id={`s-${key}`}
                inputMode="numeric"
                value={settings[key!] ?? ""}
                onChange={(e) => setSettings({ ...settings, [key!]: e.target.value.replace(/\D/g, "") })}
              />
            </Field>
          ))}
        </div>
      </Panel>
    </>
  );
}
