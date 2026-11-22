"use client";

// /admin's squads read card (D117, amendment 2026-11-19b; D132): each workspace's queue in this quota day
// and a button that runs its next batches now instead of at the next tick, plus one for every workspace. The
// press sends the PIN as x-edit-pin, like the other admin buttons; the batches run after the answer, so
// the page is refreshed and the owner reloads later to see how far they got.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { Notice } from "@/lib/brand/components/Notice";
import { copy } from "@/lib/copy";
import { fill } from "@/lib/words";

import { forgetPin, PinSheet, savedPin } from "./PinSheet";

const t = copy.admin.workspaces.squads;
const ERRORS: Partial<Record<string, string>> = t.errors;

export interface SquadsRowView {
  unionId: number;
  alliance: string;
  /** The progress in words, one sentence per line. */
  lines: string[];
  /** "run": no batch yet; "next": members left and no batch running; null: nothing to press. */
  action: "run" | "next" | null;
}

type Answer = { ok: boolean; text: string };

/** A button that POSTs `url`; "Starting…" while that press is in flight, and off while any is. */
function Press(props: {
  busy: string | null;
  url: string;
  onPress: (url: string) => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={() => props.onPress(props.url)}
      disabled={props.busy !== null}
      className={buttonClass("secondary", "font-semibold sm:justify-self-start")}
    >
      {props.busy === props.url ? t.sending : props.children}
    </button>
  );
}

export function SquadsCard({ day, rows }: { day: string; rows: SquadsRowView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);

  async function send(url: string, pin: string) {
    setBusy(url);
    try {
      const res = await fetch(url, { method: "POST", headers: { "x-edit-pin": pin } });
      const body = (await res.json().catch(() => ({}))) as { code?: string; workspaces?: string[] };
      if (res.status === 401) forgetPin();
      setAnswer(
        res.ok
          ? { ok: true, text: fill(t.started, { list: (body.workspaces ?? []).join(", ") }) }
          : { ok: false, text: ERRORS[body.code ?? "failed"] ?? t.errors.failed },
      );
      if (res.ok) router.refresh();
    } catch {
      setAnswer({ ok: false, text: t.errors.failed });
    } finally {
      setBusy(null);
    }
  }

  const press = (url: string) => {
    setAnswer(null);
    const pin = savedPin();
    if (pin) void send(url, pin);
    else setAsking(url);
  };

  const all = "/api/admin/squads-read";
  return (
    <div className="grid gap-4">
      <p className="text-body-sm text-ink/80">{fill(t.day, { day })}</p>
      {rows.length === 0 && <p className="text-body-sm">{t.empty}</p>}
      <ul className="grid gap-4">
        {rows.map((r) => {
          const url = `${all}?union=${r.unionId}`;
          return (
            <li key={r.unionId} className="grid gap-2 break-words">
              <span className="font-semibold">{r.alliance}</span>
              {r.lines.map((line) => (
                <span key={line} className="text-body-sm tabular-nums">
                  {line}
                </span>
              ))}
              {r.action && (
                <Press busy={busy} url={url} onPress={press}>
                  {r.action === "next" ? t.next : t.run}
                </Press>
              )}
            </li>
          );
        })}
      </ul>
      {rows.length > 1 && rows.some((r) => r.action) && (
        <Press busy={busy} url={all} onPress={press}>
          {t.runAll}
        </Press>
      )}
      {answer && <Notice tone={answer.ok ? "ok" : "fail"}>{answer.text}</Notice>}
      {asking && (
        <PinSheet
          onCancel={() => setAsking(null)}
          onUnlocked={(pin) => {
            setAsking(null);
            void send(asking, pin);
          }}
        />
      )}
    </div>
  );
}
