"use client";

// Raid prep → This week's raid opponent (issue 861, D165): the opponent alliance's server and tag (one check
// on the alliance's own key), changed or cleared with Undo; the Start and End reads' times (15-minute
// ticks, only those clear of events); then the result and the past raids (RaidOpponentResult.tsx).
// Mobile-first: one column at 360 px.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/lib/brand/components/Button";
import { chip, FIELD } from "@/lib/brand/components/controls";
import { hhmm } from "@/lib/private/calendar-time";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { RaidOpponentView } from "@/lib/private/raid-opponent";
import { fill } from "@/lib/words";
import { TRACKER_CALLS } from "@/lib/workspace-features";

import { HistoryPart, ResultPart, type Words } from "./RaidOpponentResult";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

type Body = Record<string, unknown>;

/** One POST; the Undo id it returned, or the refusal in words. */
async function send(slug: string, body: Body, t: WorkspaceDictionary) {
  const res = await fetch(`/api/w/${slug}/raid-opponent`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const json = (await res?.json().catch(() => null)) as {
    undo?: number | null;
    code?: string;
  } | null;
  if (res?.ok) return { ok: true as const, undo: json?.undo ?? null };
  if (res?.status === 401) return { ok: false as const, error: SIGNED_OUT };
  const key = `roll.prep.raid.err.${json?.code ?? ""}` as keyof WorkspaceDictionary;
  return { ok: false as const, error: t[key] ?? t["roll.prep.raid.err.failed"] };
}

/** The opponent's actions: set, clear and Undo, each refreshing the page; the notice with its Undo. */
function useOpponent(slug: string, view: RaidOpponentView, t: WorkspaceDictionary) {
  const router = useRouter();
  const [editing, setEditing] = useState(view.opponent === null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; undo: Body } | null>(null);
  const run = async (body: Body, after: (undo: number | null) => void) => {
    setBusy(true);
    setError(null);
    const done = await send(slug, body, t);
    setBusy(false);
    if (!done.ok) return setError(done.error);
    after(done.undo);
    router.refresh();
  };
  const saturday = view.saturday;
  const undoOf = (id: number | null): Body =>
    id === null ? { action: "clear", saturday } : { action: "undo", saturday, id };
  const set = (server: number, tag: string) =>
    run({ action: "set", saturday, server, tag }, (undo) => {
      setEditing(false);
      setNotice({ text: t["roll.prep.raid.saved"], undo: undoOf(undo) });
    });
  const clear = () =>
    run({ action: "clear", saturday }, (undo) => {
      setEditing(true);
      setNotice({ text: t["roll.prep.raid.cleared"], undo: undoOf(undo) });
    });
  const undo = (body: Body) =>
    run(body, () => {
      setNotice(null);
      setEditing(false);
    });
  return { editing, setEditing, busy, error, notice, set, clear, undo };
}

/** The server and tag to check, with Check and save (and Cancel while changing a saved one). */
function OpponentForm(props: {
  view: RaidOpponentView;
  busy: boolean;
  onSet: (server: number, tag: string) => void;
  onCancel: (() => void) | null;
  t: WorkspaceDictionary;
}) {
  const { t, busy } = props;
  const [server, setServer] = useState(
    props.view.opponent ? String(props.view.opponent.server) : "",
  );
  const [tag, setTag] = useState(props.view.opponent?.tag ?? "");
  return (
    <form
      className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr]"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSet(Number(server), tag.trim());
      }}
    >
      <label className="grid gap-2">
        <span className="font-medium">{t["roll.prep.raid.server"]}</span>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          required
          value={server}
          onChange={(e) => setServer(e.target.value.replace(/\D/g, "").slice(0, 4))}
          className={`${FIELD} text-[16px]`}
        />
      </label>
      <label className="grid gap-2">
        <span className="font-medium">{t["roll.prep.raid.tag"]}</span>
        <input
          required
          maxLength={12}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className={`${FIELD} text-[16px]`}
        />
        <span className="text-body-sm text-ink/80">{t["roll.prep.raid.tagHelp"]}</span>
      </label>
      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <Button type="submit" disabled={busy || server === "" || tag.trim() === ""}>
          {busy ? t["roll.prep.raid.checking"] : t["roll.prep.raid.check"]}
        </Button>
        {props.onCancel && (
          <Button variant="secondary" disabled={busy} onClick={props.onCancel}>
            {t["roll.prep.raid.cancel"]}
          </Button>
        )}
      </div>
    </form>
  );
}

/** The opponent: the form, or the saved one with Change and Clear, and Undo after either. */
function OpponentPart(props: { slug: string; view: RaidOpponentView; w: Words }) {
  const { view } = props;
  const { t } = props.w;
  const { editing, setEditing, busy, error, notice, set, clear, undo } = useOpponent(
    props.slug,
    view,
    t,
  );
  return (
    <>
      {view.opponent && !editing ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="font-semibold">
            {fill(t["roll.prep.raid.current"], {
              tag: view.opponent.tag,
              server: view.opponent.server,
            })}
            {view.opponent.name && <span className="font-normal"> · {view.opponent.name}</span>}
          </p>
          <button type="button" className={chip()} disabled={busy} onClick={() => setEditing(true)}>
            {t["roll.prep.raid.change"]}
          </button>
          <button type="button" className={chip()} disabled={busy} onClick={() => void clear()}>
            {t["roll.prep.raid.clear"]}
          </button>
        </div>
      ) : (
        <OpponentForm
          view={view}
          busy={busy}
          onSet={(server, tag) => void set(server, tag)}
          onCancel={view.opponent ? () => setEditing(false) : null}
          t={t}
        />
      )}
      {notice && (
        <p
          role="status"
          className="mt-2 flex flex-wrap items-center gap-3 text-body-sm font-semibold"
        >
          {notice.text}
          <button
            type="button"
            className={chip()}
            disabled={busy}
            onClick={() => void undo(notice.undo)}
          >
            {t["roll.prep.raid.undo"]}
          </button>
        </p>
      )}
      {error && <RefusalLine text={error} className="mt-2 font-semibold text-seal" />}
    </>
  );
}

/** A read's time: the ticks it may take, the saved one kept even when an event now meets it. */
function TimeSelect(props: {
  label: string;
  value: number;
  choices: number[];
  onChange: (m: number) => void;
}) {
  const options = props.choices.includes(props.value)
    ? props.choices
    : [props.value, ...props.choices].toSorted((a, b) => a - b);
  return (
    <label className="grid justify-items-start gap-2">
      <span className="font-medium">{props.label}</span>
      <select
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className={`${FIELD} max-w-40 text-[16px]`}
      >
        {options.map((m) => (
          <option key={m} value={m}>
            {hhmm(m)}
          </option>
        ))}
      </select>
    </label>
  );
}

function TimesPart(props: { slug: string; view: RaidOpponentView; w: Words }) {
  const { view, w } = props;
  const { t } = w;
  const router = useRouter();
  const [v, setV] = useState(view.times);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = v.start !== view.times.start || v.end !== view.times.end;
  const save = async () => {
    setBusy(true);
    setError(null);
    const done = await send(
      props.slug,
      { action: "times", startMinute: v.start, endMinute: v.end },
      t,
    );
    setBusy(false);
    if (!done.ok) return setError(done.error);
    setSaved(true);
    router.refresh();
  };
  const calls = TRACKER_CALLS.shield_check?.perWeek ?? 0;
  return (
    <details className="mt-4 border-t border-rule pt-3">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
        {t["roll.prep.raid.times"]}
      </summary>
      <p className="mt-1 text-body-sm text-ink/80">{t["roll.prep.raid.timesHelp"]}</p>
      <p className="mt-1 text-body-sm">
        {fill(t["roll.prep.raid.calls"], { n: new Intl.NumberFormat(w.language).format(calls) })}
      </p>
      <div className="mt-3 flex flex-wrap gap-4">
        <TimeSelect
          label={t["roll.prep.raid.start"]}
          value={v.start}
          choices={view.choices.start}
          onChange={(start) => (setSaved(false), setV({ ...v, start }))}
        />
        <TimeSelect
          label={t["roll.prep.raid.end"]}
          value={v.end}
          choices={view.choices.end}
          onChange={(end) => (setSaved(false), setV({ ...v, end }))}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="secondary" disabled={busy || !changed} onClick={() => void save()}>
          {t["roll.prep.raid.timesSave"]}
        </Button>
        <p role="status" className="text-body-sm font-semibold">
          {saved && !changed && t["roll.prep.raid.timesSaved"]}
        </p>
      </div>
      {error && <RefusalLine text={error} className="mt-2 font-semibold text-seal" />}
    </details>
  );
}

export function RaidOpponent(props: {
  slug: string;
  view: RaidOpponentView;
  t: WorkspaceDictionary;
  language: string;
  zone: string;
}) {
  const { t, view } = props;
  const w = { t, language: props.language, zone: props.zone };
  return (
    <section aria-labelledby="raid-opponent" className="drawn-card mt-4 max-w-2xl px-4 py-3">
      <h2 id="raid-opponent" className="font-subhead text-display-sm">
        {t["roll.prep.raid.head"]}
      </h2>
      <p className="mt-1">{t["roll.prep.raid.lead"]}</p>
      <OpponentPart slug={props.slug} view={view} w={w} />
      <ResultPart view={view} w={w} />
      <TimesPart slug={props.slug} view={view} w={w} />
      <HistoryPart view={view} w={w} />
    </section>
  );
}
