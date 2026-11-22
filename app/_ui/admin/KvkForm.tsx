"use client";

// /admin's KvK opponent form (D152): pick a KvK, type its server and tags, save; pick its result. Every press
// sends the PIN as x-edit-pin, as the other admin buttons do, and refreshes the page on success.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { chip } from "@/lib/brand/components/controls";
import { Notice } from "@/lib/brand/components/Notice";
import { copy } from "@/lib/copy";

import { forgetPin, PinSheet, savedPin } from "./PinSheet";
import { Field, FIELD } from "./WorkspaceForm";

const t = copy.admin.kvk;
const ERRORS: Partial<Record<string, string>> = t.errors;
const URL = "/api/admin/kvk-opponent";

export interface KvkChoice {
  at: string;
  label: string;
  server: number | null;
  tags: string[];
  result: "won" | "lost" | null;
  /** The war has started: no server or tag change. */
  locked: boolean;
  /** One line per tag: what the Start and End read. */
  lines: string[];
}

type Answer = { ok: boolean; text: string };
type Press = (body: object) => void;

/** The tags as typed: split on spaces and commas, empties dropped. */
const tagsOf = (text: string) => text.split(/[\s,]+/).filter((s) => s !== "");

/** A press: the PIN saved on this device, else asked first; then the POST and the page refreshed. */
function usePress() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<object | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  async function send(body: object, pin: string) {
    setBusy(true);
    try {
      const res = await fetch(URL, {
        method: "POST",
        headers: { "x-edit-pin": pin, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const got = (await res.json().catch(() => ({}))) as { code?: string };
      if (res.status === 401) forgetPin();
      const text = res.ok ? t.saved : (ERRORS[got.code ?? ""] ?? t.errors.failed);
      setAnswer({ ok: res.ok, text });
      if (res.ok) router.refresh();
    } catch {
      setAnswer({ ok: false, text: t.errors.failed });
    } finally {
      setBusy(false);
    }
  }
  const press: Press = (body) => {
    setAnswer(null);
    const pin = savedPin();
    if (pin) void send(body, pin);
    else setAsking(body);
  };
  const sheet = asking && (
    <PinSheet
      onCancel={() => setAsking(null)}
      onUnlocked={(pin) => {
        setAsking(null);
        void send(asking, pin);
      }}
    />
  );
  return { busy, press, answer, clear: () => setAnswer(null), sheet };
}

function OpponentFields({ c, busy, press }: { c: KvkChoice; busy: boolean; press: Press }) {
  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const server = Number(String(form.get("server") ?? "").trim());
    press({ event_at: c.at, server, tags: tagsOf(String(form.get("tags") ?? "")) });
  };
  return (
    <form key={c.at} onSubmit={save} className="grid gap-3 sm:max-w-md">
      <Field label={t.server}>
        <input
          name="server"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          autoComplete="off"
          defaultValue={c.server ?? ""}
          disabled={c.locked}
          className={FIELD}
        />
      </Field>
      <Field label={t.tags}>
        <input
          name="tags"
          autoComplete="off"
          spellCheck={false}
          defaultValue={c.tags.join(" ")}
          disabled={c.locked}
          className={FIELD}
        />
      </Field>
      {c.locked ? (
        <p className="text-ink/80">{t.locked}</p>
      ) : (
        <button type="submit" disabled={busy} className={buttonClass("secondary")}>
          {t.save}
        </button>
      )}
    </form>
  );
}

/** The result picker and what the Start and End read of each tag. */
function ResultAndReads({ c, busy, press }: { c: KvkChoice; busy: boolean; press: Press }) {
  return (
    <>
      <fieldset>
        <legend className="font-semibold">{t.result}</legend>
        <ul className="mt-1 flex flex-wrap gap-2">
          {(["won", "lost", null] as const).map((r) => (
            <li key={r ?? "none"}>
              <button
                type="button"
                aria-pressed={c.result === r}
                disabled={busy}
                className={chip(c.result === r)}
                onClick={() => press({ event_at: c.at, result: r })}
              >
                {t.results[r ?? "none"]}
              </button>
            </li>
          ))}
        </ul>
      </fieldset>
      <div>
        <h3 className="font-semibold">{t.reads}</h3>
        {c.lines.length === 0 ? (
          <p className="text-ink/80">{t.noReads}</p>
        ) : (
          <ul className="mt-1 grid gap-1 break-words">
            {c.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export function KvkForm({ choices }: { choices: KvkChoice[] }) {
  const [at, setAt] = useState(choices[0]?.at ?? "");
  const { busy, press, answer, clear, sheet } = usePress();
  const c = choices.find((x) => x.at === at) ?? choices[0];
  if (!c) return null;
  return (
    <div className="grid gap-4 text-body-sm">
      <Field label={t.event}>
        <select
          value={c.at}
          onChange={(e) => {
            setAt(e.target.value);
            clear();
          }}
          className={FIELD}
        >
          {choices.map((x) => (
            <option key={x.at} value={x.at}>
              {x.label}
            </option>
          ))}
        </select>
      </Field>
      <OpponentFields c={c} busy={busy} press={press} />
      {c.server !== null && <ResultAndReads c={c} busy={busy} press={press} />}
      {answer && <Notice tone={answer.ok ? "ok" : "fail"}>{answer.text}</Notice>}
      {sheet}
    </div>
  );
}
