"use client";

// Alliance settings → Posts (#713 part C, D159): the catalog posts the site's owner allows this alliance, each
// off until an officer turns it on. Per post: what it holds, its switch with the next post in plain words right
// under it ("Every Monday, between 00:00 and 01:15 ST, in #members.", or in yarn why nothing will go out), its
// channel, its day, its title (empty: ours) with "n of 80 characters", and the language it is written in.
// Every control has a visible label and is 44 px tall.
// One Save for the card (SaveRow, issue 585), which sends each changed post in turn and stops at the first
// refusal, keeping what was chosen.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CheckField } from "@/lib/brand/components/CheckField";
import { FIELD } from "@/lib/brand/components/controls";
import { calloutLength, cleanCallout } from "@/lib/post-callout";
import { POST_CATALOG, POST_TITLE_LIMIT } from "@/lib/post-catalog";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { PostView } from "@/lib/private/post-settings";
import type { CatalogPost, PostChannel } from "@/lib/schema-discord";
import { fill } from "@/lib/words";

import { SaveRow } from "./SaveRow";
import { SIGNED_OUT } from "./SignedOut";

const LANGUAGES: { code: WorkspaceLanguage; name: string }[] = [
  { code: "en", name: "English" },
  { code: "pt-BR", name: "Português" },
  { code: "fr", name: "Français" },
];

type Values = Pick<PostView, "on" | "channel" | "title" | "language">;
const valuesOf = (r: Values): Values => ({
  on: r.on,
  channel: r.channel,
  title: cleanCallout(r.title),
  language: r.language,
});
const same = (a: Values, b: Values) => JSON.stringify(valuesOf(a)) === JSON.stringify(valuesOf(b));

function refusal(status: number | undefined, t: WorkspaceDictionary) {
  if (status === 401) return SIGNED_OUT;
  if (status === 429) return t["posts.rateLimited"];
  if (status === 400) return t["posts.titleTooLong"];
  return t["posts.failed"];
}

/** The card's values, which differ from what the server has, and Save. */
function usePosts(slug: string, rows: PostView[], t: WorkspaceDictionary) {
  const router = useRouter();
  const start = () => Object.fromEntries(rows.map((r) => [r.post, valuesOf(r)]));
  const [values, setValues] = useState<Record<string, Values>>(start);
  const [kept, setKept] = useState<Record<string, Values>>(start);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = rows
    .map((r) => r.post)
    .filter((p) => !same(values[p] as Values, kept[p] as Values));
  const change = (post: CatalogPost, next: Partial<Values>) => {
    setSaved(false);
    setValues((v) => ({ ...v, [post]: { ...(v[post] as Values), ...next } }));
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    for (const post of changed) {
      const v = values[post] as Values;
      const res = await fetch(`/api/w/${slug}/posts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ post, ...v }),
      }).catch(() => null);
      if (!res?.ok) {
        setBusy(false);
        return setError(refusal(res?.status, t));
      }
      const body = (await res.json()) as { title: string };
      const stored = { ...v, title: body.title };
      setKept((k) => ({ ...k, [post]: stored }));
      setValues((x) => ({ ...x, [post]: stored }));
    }
    setBusy(false);
    setSaved(true);
    // The page's "On this page" row counts the posts on.
    router.refresh();
  };
  return { values, change, changes: changed.length, busy, saved, error, save };
}

/** "Members’ channel (#members)", or "(not set up)" when it has no webhook. */
function channelLabel(c: { channel: PostChannel; name: string | null }, t: WorkspaceDictionary) {
  const name = t[`posts.channel.${c.channel}`];
  return c.name ? `${name} (#${c.name})` : fill(t["posts.channel.notSet"], { channel: name });
}

/** The next post in plain words: when and where, or why nothing is posted (`warn`: on, yet nothing goes). */
function nextPost(row: PostView, v: Values, t: WorkspaceDictionary) {
  if (!v.on) return { text: t["posts.off"], warn: false };
  const target = row.channels.find((c) => c.channel === v.channel);
  if (!target?.name) {
    const channel = t[`posts.channel.${v.channel}`].toLowerCase();
    return { text: fill(t["posts.noChannel"], { channel }), warn: true };
  }
  const when = { day: row.day ?? "", from: row.from, to: row.to, channel: target.name };
  // The KvK recap goes only on a KvK's day: "After each KvK (Saturday), …", never "Every Saturday". The
  // KvK reminder goes before the KvK's start, when that start is in the event's window.
  const entry = POST_CATALOG[row.post];
  const key = entry.marks
    ? "posts.whenKvkSoon"
    : entry.weekday === "event"
      ? "posts.whenKvk"
      : row.day === null
        ? "posts.whenDaily"
        : "posts.when";
  return { text: fill(t[key], when), warn: false };
}

/**
 * Right under the switch (persona check, D159): what the switch and the channel lead to, so an officer who
 * ticks it with no webhook sees at once that nothing will go out.
 */
function NextPost(props: { row: PostView; v: Values; t: WorkspaceDictionary }) {
  const next = nextPost(props.row, props.v, props.t);
  return (
    <figure className="mt-2 border-l-2 border-rule pl-3">
      <figcaption className="font-medium">{props.t["posts.preview"]}</figcaption>
      <p className={next.warn ? "font-semibold text-yarn" : undefined}>{next.text}</p>
    </figure>
  );
}

/** The officers' title: empty for ours, counted as the server counts it (cleaned, in graphemes). */
function TitleField(props: {
  post: CatalogPost;
  title: string;
  /** Our title in the language the post is written in. */
  defaultTitle: string;
  onChange: (title: string) => void;
  t: WorkspaceDictionary;
}) {
  const { post, t } = props;
  const id = `post-${post}-title`;
  const length = calloutLength(cleanCallout(props.title));
  const over = length > POST_TITLE_LIMIT;
  return (
    <>
      <label htmlFor={id} className="mt-3 block font-medium">
        {t["posts.title"]}
      </label>
      <p id={`${id}-help`} className="text-body-sm text-ink/75">
        {fill(t["posts.titleHelp"], { title: props.defaultTitle })}
      </p>
      <input
        id={id}
        type="text"
        value={props.title}
        onChange={(e) => props.onChange(e.target.value)}
        aria-invalid={over || undefined}
        aria-describedby={`${id}-help ${id}-count`}
        autoComplete="off"
        className={`${FIELD} mt-2 text-[16px]`}
      />
      <p
        id={`${id}-count`}
        className={`mt-1 text-body-sm tabular-nums ${over ? "font-semibold text-seal" : "text-ink/75"}`}
      >
        {over ? t["posts.titleTooLong"] : fill(t["posts.titleCount"], { n: length })}
      </p>
    </>
  );
}

function PostFields(props: {
  row: PostView;
  v: Values;
  onChange: (next: Partial<Values>) => void;
  t: WorkspaceDictionary;
}) {
  const { row, v, t } = props;
  const id = `post-${row.post}`;
  const select = `${FIELD} max-w-sm text-[16px]`;
  return (
    <div role="group" aria-labelledby={`${id}-name`} className="mt-4 border-t border-rule pt-3">
      <h3 id={`${id}-name`} className="font-medium">
        {t[`posts.${row.post}.name`]}
      </h3>
      <p className="text-body-sm text-ink/75">{t[`posts.${row.post}.what`]}</p>
      <div className="mt-2">
        <CheckField
          label={t["posts.turnOn"]}
          checked={v.on}
          onChange={(e) => props.onChange({ on: e.target.checked })}
        />
      </div>
      <NextPost row={row} v={v} t={t} />
      <label className="mt-3 grid justify-items-start gap-2">
        <span className="font-medium">{t["posts.channel"]}</span>
        <select
          value={v.channel}
          onChange={(e) => props.onChange({ channel: e.target.value as PostChannel })}
          className={select}
        >
          {row.channels.map((c) => (
            <option key={c.channel} value={c.channel}>
              {channelLabel(c, t)}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-3">
        <span className="block font-medium">{t["posts.day"]}</span>
        {fill(t[`posts.${row.post}.day`], { day: row.day ?? "" })}
      </p>
      <TitleField
        post={row.post}
        title={v.title}
        defaultTitle={row.defaultTitles[v.language]}
        onChange={(title) => props.onChange({ title })}
        t={t}
      />
      <label className="mt-3 grid justify-items-start gap-2">
        <span className="font-medium">{t["posts.language"]}</span>
        <select
          value={v.language}
          onChange={(e) => props.onChange({ language: e.target.value as WorkspaceLanguage })}
          className={`${FIELD} max-w-56 text-[16px]`}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function PostCatalog(props: {
  slug: string;
  rows: PostView[];
  t: WorkspaceDictionary;
  language: string;
}) {
  const { t } = props;
  const { values, change, changes, busy, saved, error, save } = usePosts(props.slug, props.rows, t);
  return (
    <section aria-labelledby="posts" className="drawn-card mt-6 max-w-2xl px-4 py-3">
      <h2 id="posts" className="font-subhead text-display-sm">
        {t["posts.head"]}
      </h2>
      <p className="mt-1">{t["posts.lead"]}</p>
      {props.rows.map((row) => (
        <PostFields
          key={row.post}
          row={row}
          v={values[row.post] as Values}
          onChange={(next) => change(row.post, next)}
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
