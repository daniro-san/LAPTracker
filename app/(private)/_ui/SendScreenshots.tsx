"use client";

// "Send screenshots" (issue 299): the officer picks one or more pictures. Each is drawn on a canvas as a
// PNG, without the phone's status bar and at most MAX_WIDTH wide, and read on the server one per request
// (under Vercel's body limit); then the pictures' text lines become drafts. The pictures are not kept.
// A picture that is not recognised can be given a type, or left; a map never becomes data.
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { track, type ScreenshotKind } from "@/lib/analytics/events";
import type { DraftSummary, Outcome } from "@/lib/private/import";
import type { ImportKind, Scope } from "@/lib/private/import-kinds";

/** Wide enough for the OCR (it reads at 716 px), small enough to upload quickly. */
const MAX_WIDTH = 1080;

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

const fillIn = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));

/** The picture as a PNG: the top band of a full-screen phone capture dropped, scaled down when wide. */
async function toPng(file: File, statusBar: { share: number; aspect: number }): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const top =
    bitmap.height >= bitmap.width * statusBar.aspect
      ? Math.round(bitmap.height * statusBar.share)
      : 0;
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round((bitmap.height - top) * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.drawImage(
    bitmap,
    0,
    top,
    bitmap.width,
    bitmap.height - top,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("no png"))), "image/png"),
  );
}

async function post(url: string, body: BodyInit, type: string) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": type }, body });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

/** Each picture's text lines, one request each; a picture that cannot be converted or read is skipped. */
async function readAll(
  files: File[],
  slug: string,
  statusBar: { share: number; aspect: number },
  onProgress: (p: { n: number; total: number }) => void,
): Promise<string[][]> {
  const pages: string[][] = [];
  for (const [i, file] of files.entries()) {
    onProgress({ n: i + 1, total: files.length });
    if (!file.type.startsWith("image/")) continue;
    try {
      const png = await toPng(file, statusBar);
      const read = (await post(`/api/w/${slug}/import/read`, png, "image/png")) as {
        lines: string[];
      };
      pages.push(read.lines);
    } catch {
      // Counted by the caller as a picture that could not be read.
    }
  }
  return pages;
}

/** "Send screenshots": a 44 px button that opens the phone's picker, several pictures at once. */
function FilePicker(props: {
  label: string | undefined;
  busy: boolean;
  onFiles: (f: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const files = [...(e.currentTarget.files ?? [])];
          e.currentTarget.value = "";
          if (files.length > 0) props.onFiles(files);
        }}
      />
      <button
        type="button"
        disabled={props.busy}
        onClick={() => input.current?.click()}
        className="ink-button inline-flex min-h-11 w-full items-center justify-center px-4 font-medium disabled:opacity-50 sm:w-auto"
      >
        {props.label}
      </button>
    </>
  );
}

const kindOf = (o: Outcome, drafts: DraftSummary[]): ScreenshotKind =>
  o.status === "draft"
    ? (drafts[o.draft]?.kind ?? "unrecognised")
    : o.status === "soon" || o.status === "empty"
      ? o.kind
      : o.status;

export function SendScreenshots(props: {
  slug: string;
  language: string;
  w: SendWords;
  kinds: Record<ImportKind, string>;
  picks: TypeChoice[];
  maxPictures: number;
  statusBar: { share: number; aspect: number };
}) {
  const { slug, w, maxPictures } = props;
  const router = useRouter();
  const [progress, setProgress] = useState<{ n: number; total: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function makeDrafts(
    pages: string[][],
    lost: number,
    pick?: { kind: ImportKind; scope: Scope | null },
  ) {
    const made = (await post(
      `/api/w/${slug}/import`,
      JSON.stringify({ pictures: pages.map((lines) => ({ lines })), ...(pick && { pick }) }),
      "application/json",
    )) as Pick<Result, "drafts" | "outcomes">;
    for (const o of made.outcomes) track("ws_screenshot_sent", { kind: kindOf(o, made.drafts) });
    const unrecognised = pages.filter((_, i) => made.outcomes[i]?.status === "unrecognised");
    setResult({ ...made, unrecognised, lost });
    router.refresh();
  }

  async function send(files: File[]) {
    setError(null);
    setResult(null);
    if (files.length > maxPictures)
      return setError(fillIn(w["import.tooMany"] ?? "", { n: maxPictures }));
    const pages = await readAll(files, slug, props.statusBar, setProgress);
    setProgress(null);
    if (pages.length === 0) return setError(w["import.readFailed"] ?? "");
    await makeDrafts(pages, files.length - pages.length).catch(() =>
      setError(w["import.e.failed"] ?? ""),
    );
  }

  return (
    <div className="mt-4">
      <FilePicker label={w["import.send"]} busy={progress !== null} onFiles={(f) => void send(f)} />
      <p className="mt-2 text-body-sm text-ink/80">{w["import.help"]}</p>
      <div aria-live="polite" className="mt-2">
        {progress && <p>{fillIn(w["import.reading"] ?? "", progress)}</p>}
        {error && <p className="border-l-4 border-seal pl-3">{error}</p>}
        {result && (
          <Results
            {...props}
            result={result}
            onPick={(pick) =>
              void makeDrafts(result.unrecognised, 0, pick).catch(() =>
                setError(w["import.e.failed"] ?? ""),
              )
            }
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
    d.scope
      ? fillIn(w["import.kindScope"] ?? "", {
          kind: kinds[d.kind],
          scope: w[`import.scope.${d.scope}`] ?? "",
        })
      : kinds[d.kind];
  const counts = (d: DraftSummary) =>
    [
      plural(w, language, "import.rows", d.rows),
      ...(d.doubtful ? [plural(w, language, "import.doubtful", d.doubtful)] : []),
      ...(d.notFound ? [plural(w, language, "import.notFound", d.notFound)] : []),
    ].join(", ");
  const notes = new Set(
    result.outcomes.flatMap((o) =>
      o.status === "map"
        ? [w["import.map"] ?? ""]
        : o.status === "soon" || o.status === "empty"
          ? [
              fillIn(w[o.status === "soon" ? "import.soon" : "import.empty"] ?? "", {
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
          <p>{fillIn(w["import.reply.read"] ?? "", { what: label(d), counts: counts(d) })}</p>
          {d.leftOut > 0 && (
            <p className="text-body-sm">{plural(w, language, "import.leftOut", d.leftOut)}</p>
          )}
          <a
            href={`/w/${props.slug}/import/${d.id}`}
            className="inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4"
          >
            {w["import.open"]}
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
        <li className="px-3 py-2">{plural(w, language, "import.lost", result.lost)}</li>
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
      <p>{w["import.unrecognised"]}</p>
      <p className="mt-1 text-body-sm font-semibold">{w["import.pickType"]}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {props.picks.map((p) => (
          <button
            key={`${p.kind}:${p.scope}`}
            type="button"
            onClick={() => props.onPick({ kind: p.kind, scope: p.scope })}
            className="inline-flex min-h-11 items-center border border-rule px-3 text-body-sm font-medium"
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={props.onDiscard}
          className="inline-flex min-h-11 items-center px-3 text-body-sm font-medium underline underline-offset-4"
        >
          {w["import.discard"]}
        </button>
      </div>
    </li>
  );
}
