"use client";

// "Send screenshots" (issue 299): the officer picks one or more pictures. Each is drawn on a canvas as a
// PNG, without the phone's status bar and at most MAX_WIDTH wide, and read on the server one per request
// (under Vercel's body limit); then the pictures' text lines become drafts. The pictures are not kept.
// A picture that is not recognised can be given a type, or left; a map never becomes data.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { track, type ScreenshotKind } from "@/lib/analytics/events";
import { buttonClass } from "@/lib/brand/components/Button";
import { chip } from "@/lib/brand/components/controls";
import type { DraftSummary, Outcome } from "@/lib/private/import";
import type { ImportKind, Scope, Screen } from "@/lib/private/import-kinds";

import { fillIn } from "./draft-known";
import { isSignedOut, post, readAll } from "./screenshot-upload";
import { FilePicker, type Preset } from "./ScreenshotPicker";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

export interface SendWords {
  [key: string]: string;
}

export interface TypeChoice {
  kind: ImportKind;
  scope: Scope | null;
  label: string;
}

interface Result {
  drafts: DraftSummary[];
  outcomes: Outcome[];
  /** The text lines of the pictures that were not recognised, for "Pick the type". */
  unrecognised: string[][];
  lost: number;
}

const kindOf = (o: Outcome, drafts: DraftSummary[]): ScreenshotKind =>
  o.status === "draft"
    ? (drafts[o.draft]?.kind ?? "unrecognised")
    : o.status === "soon" || o.status === "empty"
      ? o.kind
      : o.status;

/** From a tab's button, one draft and nothing else to say: straight to its review (D110). */
function onlyDraft(made: Pick<Result, "drafts" | "outcomes">, lost: number): number | null {
  const [only, ...more] = made.drafts;
  const clean = lost === 0 && made.outcomes.every((o) => o.status === "draft");
  return only && more.length === 0 && clean ? only.id : null;
}

interface SendProps {
  slug: string;
  language: string;
  w: SendWords;
  kinds: Record<ImportKind, string>;
  picks: TypeChoice[];
  maxPictures: number;
  statusBar: { share: number; aspect: number };
  /** A tab's button (D110): its text, its types, and the question above two types. Home has none. */
  button?: string;
  presets?: Preset[];
  ask?: string;
}

/** Reading the pictures, then making the drafts; every step runs inside `run`, which keeps `busy` on. */
function useSend(props: SendProps) {
  const { slug, w, maxPictures } = props;
  const router = useRouter();
  const [progress, setProgress] = useState<{ n: number; total: number } | null>(null);
  // Busy from the first picture until the drafts exist (ADV-10): a second tap cannot make a second set.
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Pages already read when making the drafts failed: "Try again" sends them without reading again. */
  const [unsent, setUnsent] = useState<{
    pages: string[][];
    lost: number;
    pick?: Screen;
    preset?: ImportKind;
  } | null>(null);

  async function makeDrafts(pages: string[][], lost: number, pick?: Screen, preset?: ImportKind) {
    setUnsent(null);
    try {
      const made = (await post(
        `/api/w/${slug}/shots`,
        JSON.stringify({
          pictures: pages.map((lines) => ({ lines })),
          ...(pick && { pick }),
          ...(preset && { preset }),
        }),
        "application/json",
      )) as Pick<Result, "drafts" | "outcomes">;
      for (const o of made.outcomes) track("ws_screenshot_sent", { kind: kindOf(o, made.drafts) });
      const only = preset && onlyDraft(made, lost);
      if (only) return router.push(`/w/${slug}/shots/${only}`);
      const unrecognised = pages.filter((_, i) => made.outcomes[i]?.status === "unrecognised");
      setResult({ ...made, unrecognised, lost });
      router.refresh();
    } catch (e) {
      setUnsent({ pages, lost, ...(pick && { pick }), ...(preset && { preset }) });
      setError(isSignedOut(e) ? SIGNED_OUT : (w["shots.e.failed"] ?? ""));
    }
  }

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }

  async function send(files: File[], preset?: ImportKind) {
    setResult(null);
    setUnsent(null);
    if (files.length > maxPictures)
      return setError(fillIn(w["shots.tooMany"] ?? "", { n: maxPictures }));
    const { pages, signedOut } = await readAll(files, slug, props.statusBar, setProgress);
    setProgress(null);
    if (signedOut) return setError(SIGNED_OUT);
    if (pages.length === 0) return setError(w["shots.readFailed"] ?? "");
    await makeDrafts(pages, files.length - pages.length, undefined, preset);
  }
  return { progress, busy, result, setResult, error, unsent, makeDrafts, run, send };
}

export function SendScreenshots(props: SendProps) {
  const { w } = props;
  const { progress, busy, result, setResult, error, unsent, makeDrafts, run, send } =
    useSend(props);
  return (
    <div className="mt-4">
      <FilePicker
        label={props.button ?? w["shots.send"]}
        busy={busy}
        presets={props.presets ?? []}
        ask={props.ask}
        onFiles={(f, preset) => void run(() => send(f, preset?.kind))}
      />
      {!props.presets && <p className="mt-2 text-body-sm text-ink/80">{w["shots.help"]}</p>}
      <div aria-live="polite" className="mt-2">
        {progress && <p>{fillIn(w["shots.reading"] ?? "", progress)}</p>}
        {error && <RefusalLine text={error} className="border-l-4 border-seal pl-3" />}
        {unsent && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(() => makeDrafts(unsent.pages, unsent.lost, unsent.pick, unsent.preset))
            }
            className={buttonClass("primary", "mt-2")}
          >
            {w["shots.tryAgain"]}
          </button>
        )}
        {result && (
          <Results
            {...props}
            result={result}
            onPick={(pick) => void run(() => makeDrafts(result.unrecognised, 0, pick))}
            onDiscard={() => setResult({ ...result, unrecognised: [] })}
          />
        )}
      </div>
    </div>
  );
}

function plural(w: SendWords, language: string, key: string, n: number) {
  const form = new Intl.PluralRules(language).select(n) === "one" ? "one" : "other";
  return fillIn(w[`${key}.${form}`] ?? "", { n });
}

function Results(props: {
  slug: string;
  language: string;
  w: SendWords;
  kinds: Record<ImportKind, string>;
  picks: TypeChoice[];
  result: Result;
  onPick: (pick: { kind: ImportKind; scope: Scope | null }) => void;
  onDiscard: () => void;
}) {
  const { w, language, kinds, result } = props;
  const label = (d: DraftSummary) =>
    !d.scope
      ? kinds[d.kind]
      : d.scopeSure
        ? (w[`shots.kindScope.${d.kind}.${d.scope}`] ?? kinds[d.kind])
        : fillIn(w["shots.kindUnsure"], { kind: kinds[d.kind] });
  const counts = (d: DraftSummary) =>
    [
      plural(w, language, "shots.rows", d.rows),
      ...(d.doubtful ? [plural(w, language, "shots.doubtful", d.doubtful)] : []),
      ...(d.notFound ? [plural(w, language, "shots.notFound", d.notFound)] : []),
    ].join(", ");
  const notes = new Set(
    result.outcomes.flatMap((o) =>
      o.status === "map"
        ? [w["shots.map"] ?? ""]
        : o.status === "soon" || o.status === "empty"
          ? [
              fillIn(w[o.status === "soon" ? "shots.soon" : "shots.empty"] ?? "", {
                what: kinds[o.kind],
              }),
            ]
          : [],
    ),
  );
  return (
    <ul className="space-y-2">
      {result.drafts.map((d) => (
        <li key={d.id} className="border border-rule px-3 py-2">
          <p>{fillIn(w["shots.reply.read"] ?? "", { what: label(d), counts: counts(d) })}</p>
          {d.leftOut > 0 && (
            <p className="text-body-sm">{plural(w, language, "shots.leftOut", d.leftOut)}</p>
          )}
          <a
            href={`/w/${props.slug}/shots/${d.id}`}
            className="inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4"
          >
            {w["shots.open"]}
          </a>
        </li>
      ))}
      {[...notes].map((note) => (
        <li key={note} className="border border-rule px-3 py-2">
          {note}
        </li>
      ))}
      {result.unrecognised.length > 0 && <PickType {...props} />}
      {result.lost > 0 && (
        <li className="px-3 py-2">{plural(w, language, "shots.lost", result.lost)}</li>
      )}
    </ul>
  );
}

function PickType(props: {
  w: SendWords;
  picks: TypeChoice[];
  onPick: (pick: { kind: ImportKind; scope: Scope | null }) => void;
  onDiscard: () => void;
}) {
  const { w } = props;
  return (
    <li className="border border-rule px-3 py-2">
      <p>{w["shots.unrecognised"]}</p>
      <p className="mt-1 text-body-sm font-semibold">{w["shots.pickType"]}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {props.picks.map((p) => (
          <button
            key={`${p.kind}:${p.scope}`}
            type="button"
            onClick={() => props.onPick({ kind: p.kind, scope: p.scope })}
            className={chip()}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={props.onDiscard}
          className="inline-flex min-h-11 items-center px-3 text-body-sm font-medium underline underline-offset-4"
        >
          {w["shots.discard"]}
        </button>
      </div>
    </li>
  );
}
