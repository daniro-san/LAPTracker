"use client";

// Alliance settings → Your line on our posts (#713, D155): one field per post the alliance gets from us,
// each with a visible label, where it goes, "n of 120 characters" and a live preview of the next post's first
// lines: the line as typed, then our title. One Save for the card (SaveRow, issue 585), which sends each
// changed post in turn and stops at the first refusal, keeping what was typed. Shown only while
// `post_callouts` is on (D134).
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FIELD } from "@/lib/brand/components/controls";
import { CALLOUT_LIMIT, calloutLength } from "@/lib/post-callout";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { CalloutView } from "@/lib/private/post-callouts";
import type { PostKey } from "@/lib/schema-discord";
import { fill } from "@/lib/words";

import { SaveRow } from "./SaveRow";
import { SIGNED_OUT } from "./SignedOut";

type Lines = Record<PostKey, string>;

const linesOf = (rows: CalloutView[]) =>
  Object.fromEntries(rows.map((r) => [r.post, r.callout])) as Lines;

/** The refusal in words: signed out, too many saves, too long, or anything else. */
function refusal(status: number | undefined, t: WorkspaceDictionary) {
  if (status === 401) return SIGNED_OUT;
  if (status === 429) return t["callouts.rateLimited"];
  if (status === 400) return t["callouts.tooLong"];
  return t["callouts.failed"];
}

/** The card's lines, which differ from what the server has, and Save. */
function useCallouts(slug: string, rows: CalloutView[], t: WorkspaceDictionary) {
  const router = useRouter();
  const [lines, setLines] = useState(() => linesOf(rows));
  const [kept, setKept] = useState(() => linesOf(rows));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = rows.map((r) => r.post).filter((p) => lines[p].trim() !== kept[p].trim());
  const change = (post: PostKey, text: string) => {
    setSaved(false);
    setLines((l) => ({ ...l, [post]: text }));
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    for (const post of changed) {
      const res = await fetch(`/api/w/${slug}/callouts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ post, callout: lines[post] }),
      }).catch(() => null);
      if (!res?.ok) {
        setBusy(false);
        return setError(refusal(res?.status, t));
      }
      const body = (await res.json()) as { callout: string };
      setKept((k) => ({ ...k, [post]: body.callout }));
      setLines((l) => ({ ...l, [post]: body.callout }));
    }
    setBusy(false);
    setSaved(true);
    // The page's "On this page" row counts the lines set.
    router.refresh();
  };
  return { lines, change, changes: changed.length, busy, saved, error, save };
}

/** One post's field, its count and its preview. */
function CalloutField(props: {
  row: CalloutView;
  value: string;
  onChange: (text: string) => void;
  t: WorkspaceDictionary;
}) {
  const { row, value, t } = props;
  const id = `callout-${row.post}`;
  const length = calloutLength(value.trim());
  const over = length > CALLOUT_LIMIT;
  const line = value.replace(/\s+/g, " ").trim();
  return (
    <div className="mt-4 border-t border-rule pt-3">
      <label htmlFor={id} className="font-medium">
        {t[`callouts.post.${row.post}`]}
      </label>
      <p id={`${id}-where`} className="text-body-sm text-ink/75">
        {t[`callouts.where.${row.post}`]}
      </p>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => props.onChange(e.target.value)}
        aria-invalid={over || undefined}
        aria-describedby={`${id}-where ${id}-count`}
        autoComplete="off"
        className={`${FIELD} mt-2 text-[16px]`}
      />
      <p
        id={`${id}-count`}
        className={`mt-1 text-body-sm tabular-nums ${over ? "font-semibold text-seal" : "text-ink/75"}`}
      >
        {over ? t["callouts.tooLong"] : fill(t["callouts.count"], { n: length })}
      </p>
      <figure className="mt-2 border-l-2 border-rule pl-3 ph-no-capture">
        <figcaption className="text-label text-ink/75">{t["callouts.preview"]}</figcaption>
        <p className="mt-1 break-words">
          {line || <span className="text-ink/75">{t["callouts.noLine"]}</span>}
        </p>
        <p className="font-semibold">{row.title}</p>
        <p className="text-ink/75">{t["callouts.rest"]}</p>
      </figure>
    </div>
  );
}

export function PostCallouts(props: {
  slug: string;
  rows: CalloutView[];
  t: WorkspaceDictionary;
  language: string;
}) {
  const { t } = props;
  const { lines, change, changes, busy, saved, error, save } = useCallouts(
    props.slug,
    props.rows,
    t,
  );
  return (
    <section aria-labelledby="callouts" className="drawn-card mt-6 max-w-2xl px-4 py-3">
      <h2 id="callouts" className="font-subhead text-display-sm">
        {t["callouts.head"]}
      </h2>
      <p className="mt-1">{t["callouts.lead"]}</p>
      {props.rows.map((row) => (
        <CalloutField
          key={row.post}
          row={row}
          value={lines[row.post]}
          onChange={(text) => change(row.post, text)}
          t={t}
        />
      ))}
      <SaveRow
        changes={changes}
        busy={busy}
        saved={saved}
        error={error}
        onSave={() => void save()}
        t={t}
        language={props.language}
      />
    </section>
  );
}
