"use client";

// /admin's KvK opponent form (D152): pick a KvK, type its server and tags, save; pick its result. Every press
// sends the PIN as x-edit-pin, as the other admin buttons do, and refreshes the page on success.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { CheckField } from "@/lib/brand/components/CheckField";
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
  /** The saved server's ranks board read (D155), or null before any. */
  suggestion: KvkSuggestion | null;
  /** "Suggest tags" may read the board now. */
  canSuggest: boolean;
}

export interface KvkSuggestion {
  /** Where the chips come from and when, or why there are none. */
  line: string;
  /** In board order, the mightiest first; empty when the read failed. */
  chips: { tag: string; label: string }[];
}

type Answer = { ok: boolean; text: string };
/** `ok`: the notice on success; none for the suggest press, whose outcome the card shows. */
type Press = (body: object, ok?: string | null) => void;

/** The tags as typed: split on spaces and commas, empties dropped. */
const tagsOf = (text: string) => text.split(/[\s,]+/).filter((s) => s !== "");

/** A press: the PIN saved on this device, else asked first; then the POST and the page refreshed. */
function usePress() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<{ body: object; ok: string | null } | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  async function send(body: object, ok: string | null, pin: string) {
    setBusy(true);
    try {
      const res = await fetch(URL, {
        method: "POST",
        headers: { "x-edit-pin": pin, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const got = (await res.json().catch(() => ({}))) as { code?: string };
      if (res.status === 401) forgetPin();
      const text = res.ok ? ok : (ERRORS[got.code ?? ""] ?? t.errors.failed);
      setAnswer(text === null ? null : { ok: res.ok, text });
      if (res.ok) router.refresh();
    } catch {
      setAnswer({ ok: false, text: t.errors.failed });
    } finally {
      setBusy(false);
    }
  }
  const press: Press = (body, ok = t.saved) => {
    setAnswer(null);
    const pin = savedPin();
    if (pin) void send(body, ok, pin);
    else setAsking({ body, ok });
  };
  const sheet = asking && (
    <PinSheet
      onCancel={() => setAsking(null)}
      onUnlocked={(pin) => {
        setAsking(null);
        void send(asking.body, asking.ok, pin);
      }}
    />
  );
  return { busy, press, answer, clear: () => setAnswer(null), sheet };
}

/** Which chips are ticked and what stays in "Other tags": with no tags saved every chip, else the saved and
 * typed ones; a typed tag the board suggests moves onto its chip. */
function split(chips: string[], saved: string[], typed: string[]) {
  const picked = chips.filter((x) => saved.length === 0 || saved.includes(x) || typed.includes(x));
  return { picked: new Set(picked), text: typed.filter((x) => !chips.includes(x)).join(" ") };
}

/** The board's suggestion (D155): where it comes from, its chips, and "Suggest tags" while the board may be
 * read. The chips are the form's state, so a board read after a press keeps what was typed. */
function Suggestion({
  c,
  busy,
  press,
  picked,
  toggle,
}: {
  c: KvkChoice;
  busy: boolean;
  press: Press;
  picked: Set<string>;
  toggle: (tag: string) => void;
}) {
  const chips = c.suggestion?.chips ?? [];
  return (
    <>
      {c.suggestion && <p className="text-ink/80">{c.suggestion.line}</p>}
      {chips.length > 0 && (
        <fieldset>
          <legend className="font-semibold">{t.suggest.chips}</legend>
          <ul className="mt-1 flex flex-wrap gap-2">
            {chips.map((x) => (
              <li key={x.tag}>
                <CheckField
                  variant="chip"
                  label={x.label}
                  checked={picked.has(x.tag)}
                  onChange={() => toggle(x.tag)}
                  disabled={c.locked}
                />
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      {c.canSuggest && (
        <button
          type="button"
          disabled={busy}
          className={chip()}
          onClick={() => press({ event_at: c.at, suggest: true }, null)}
        >
          {t.suggest.button}
        </button>
      )}
    </>
  );
}

function OpponentFields({ c, busy, press }: { c: KvkChoice; busy: boolean; press: Press }) {
  const chips = (c.suggestion?.chips ?? []).map((x) => x.tag);
  const [state, setState] = useState(() => split(chips, c.tags, c.tags));
  // A new board read (after a press or a save) merges what is typed into its chips: nothing typed is lost.
  const [seen, setSeen] = useState(chips.join(" "));
  if (seen !== chips.join(" ")) {
    setSeen(chips.join(" "));
    setState(split(chips, c.tags, tagsOf(state.text)));
  }
  const toggle = (tag: string) =>
    setState((s) => {
      const picked = new Set(s.picked);
      if (!picked.delete(tag)) picked.add(tag);
      return { ...s, picked };
    });
  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const server = Number(String(form.get("server") ?? "").trim());
    // The ticked chips in board order, then the other tags as typed; the route drops duplicates.
    const tags = [...chips.filter((x) => state.picked.has(x)), ...tagsOf(state.text)];
    press({ event_at: c.at, server, tags });
  };
  return (
    <form onSubmit={save} className="grid gap-3 sm:max-w-md">
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
      <Suggestion c={c} busy={busy} press={press} picked={state.picked} toggle={toggle} />
      <Field label={chips.length > 0 ? t.suggest.other : t.tags}>
        <input
          name="tags"
          autoComplete="off"
          spellCheck={false}
          value={state.text}
          onChange={(e) => {
            const text = e.target.value;
            setState((s) => ({ ...s, text }));
          }}
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
      {/* Reset by another KvK or a save of its tags; a board read alone keeps what was typed. */}
      <OpponentFields key={`${c.at}|${c.tags.join(" ")}`} c={c} busy={busy} press={press} />
      {c.server !== null && <ResultAndReads c={c} busy={busy} press={press} />}
      {answer && <Notice tone={answer.ok ? "ok" : "fail"}>{answer.text}</Notice>}
      {sheet}
    </div>
  );
}
