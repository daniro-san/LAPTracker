"use client";

// The weekly cleanup's warning (D119, owner 2026-11-18). PicturesDueCard: Home's card from 7 days before a
// notice picture is due, naming the notices and the day, with "Review them". PicturesDueList: the review
// list, one card per picture with its thumbnail and title, and Keep (never cleaned), Download (the file) and
// "Use in another notice" (a copy with its own clock). Every button is 44 px; names go through isolate().
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { FIELD } from "@/lib/brand/components/controls";
import { Notice } from "@/lib/brand/components/Notice";
import { fill, isolate } from "@/lib/copy";
import type {
  WorkspaceDictionary,
  WorkspaceKey,
  WorkspaceLanguage,
} from "@/lib/private/dictionary";
import type { DueItem } from "@/lib/private/notice-picture-due";

import { smallButton } from "./NoticeBits";
import { isSignedOut, post } from "./screenshot-upload";

/** A server day (YYYY-MM-DD) as "Nov 25" / "25 de nov." in the viewer's language. */
const dayOf = (day: string, language: WorkspaceLanguage) =>
  new Intl.DateTimeFormat(language, { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );

/** At most this many titles in the card's sentence; the rest are "and N more". */
const NAMED = 3;

export function PicturesDueCard(props: {
  slug: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  items: Pick<DueItem, "title" | "after">[];
}) {
  const { t, items } = props;
  const [first] = items;
  if (!first) return null;
  const named = items.slice(0, NAMED).map((i) => `“${isolate(i.title)}”`);
  const more = items.length - named.length;
  const titles =
    named.join(", ") + (more > 0 ? ` ${fill(t["notices.pictures.more"], { n: more })}` : "");
  const date = dayOf(first.after, props.language);
  return (
    <section aria-labelledby="pictures-due" className="drawn-card mt-6 px-4 py-3">
      <h2 id="pictures-due" className="font-semibold">
        {t["notices.pictures.cardTitle"]}
      </h2>
      <p className="mt-1">
        {items.length === 1
          ? fill(t["notices.pictures.one"], { title: titles, date })
          : fill(t["notices.pictures.many"], { n: items.length, titles, date })}
      </p>
      <a href={`/w/${props.slug}/notices/pictures`} className={buttonClass("secondary", "mt-2")}>
        {t["notices.pictures.review"]}
      </a>
    </section>
  );
}

type Target = { id: number; title: string };
type Send = (path: string, body: object, done: string) => Promise<void>;

/** "Use in another notice": which live notice gets a copy, and Copy. */
function ReuseForm(props: {
  id: string;
  t: WorkspaceDictionary;
  from: number;
  others: Target[];
  busy: boolean;
  send: Send;
}) {
  const { t, others } = props;
  const [to, setTo] = useState<number | null>(others[0]?.id ?? null);
  const target = others.find((n) => n.id === to);
  const copy = () =>
    target &&
    props.send(
      "reuse",
      { from: props.from, to: target.id },
      fill(t["notices.pictures.reused"], { title: isolate(target.title) }),
    );
  return (
    <div className="mt-3">
      <label htmlFor={props.id} className="block font-semibold">
        {t["notices.pictures.reuseTo"]}
      </label>
      <p className="text-body-sm text-ink/70">{t["notices.pictures.reuseHelp"]}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        <select
          id={props.id}
          value={to ?? ""}
          onChange={(e) => setTo(Number(e.target.value))}
          className={`${FIELD} min-w-0 flex-1`}
        >
          {others.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={props.busy || !target}
          onClick={copy}
          className={buttonClass("primary")}
        >
          {t["notices.pictures.copy"]}
        </button>
      </div>
    </div>
  );
}

/** The thumbnail, the notice's title (a link) and the day after which the picture may go. */
function Heading(props: {
  slug: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  item: DueItem;
  id: string;
}) {
  const { item, t } = props;
  return (
    <div className="flex gap-3">
      <img
        src={item.picture.src}
        alt=""
        width={item.picture.width}
        height={item.picture.height}
        loading="lazy"
        className="h-20 w-20 shrink-0 border border-rule object-cover sm:h-24 sm:w-24"
      />
      <div className="min-w-0">
        <a
          id={props.id}
          href={`/w/${props.slug}/notices/${item.noticeId}`}
          className="inline-flex min-h-11 items-center font-semibold break-words underline underline-offset-4"
        >
          {item.title}
        </a>
        <p className="text-body-sm text-ink/80">
          {fill(t["notices.pictures.after"], { date: dayOf(item.after, props.language) })}
        </p>
      </div>
    </div>
  );
}

function Item(props: {
  slug: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  item: DueItem;
  targets: Target[];
}) {
  const { t, item, slug } = props;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "fail"; text: string } | null>(null);
  const [choosing, setChoosing] = useState(false);
  /** Kept here: the list keeps the card, with its line, until the page is read again. */
  const [kept, setKept] = useState(false);
  const others = props.targets.filter((n) => n.id !== item.noticeId);
  const send: Send = async (path, body, done) => {
    setBusy(true);
    setNote(null);
    try {
      const url = `/api/w/${slug}/notices/picture/${path}`;
      await post(url, JSON.stringify(body), "application/json");
      setNote({ tone: "ok", text: done });
      setChoosing(false);
      if (path === "keep") setKept(true);
    } catch (e) {
      const key: WorkspaceKey = isSignedOut(e) ? "signedOut.text" : "notices.pictures.failed";
      setNote({ tone: "fail", text: t[key] });
    }
    setBusy(false);
  };
  const id = `due-${item.noticeId}`;
  const keep = () =>
    send("keep", { id: item.noticeId, keep: true }, t["notices.pictures.keptDone"]);
  return (
    <li aria-labelledby={id} className="drawn-card px-4 py-3">
      <Heading slug={slug} t={t} language={props.language} item={item} id={id} />
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={busy || kept} onClick={keep} className={smallButton()}>
          {t["notices.pictures.keep"]}
        </button>
        <a href={`${item.picture.src}&download=1`} download className={smallButton()}>
          {t["notices.pictures.download"]}
        </a>
        {others.length > 0 && (
          <button
            type="button"
            disabled={busy}
            aria-expanded={choosing}
            onClick={() => setChoosing(!choosing)}
            className={smallButton()}
          >
            {t["notices.pictures.reuse"]}
          </button>
        )}
      </div>
      {choosing && (
        <ReuseForm
          id={`${id}-to`}
          t={t}
          from={item.noticeId}
          others={others}
          busy={busy}
          send={send}
        />
      )}
      {note && (
        <Notice tone={note.tone} className="mt-2">
          {note.text}
        </Notice>
      )}
    </li>
  );
}

export function PicturesDueList(props: {
  slug: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  items: DueItem[];
  targets: { id: number; title: string }[];
}) {
  if (props.items.length === 0) return <p className="mt-4">{props.t["notices.pictures.none"]}</p>;
  return (
    <ul className="mt-4 grid max-w-2xl gap-4">
      {props.items.map((item) => (
        <Item
          key={item.noticeId}
          slug={props.slug}
          t={props.t}
          language={props.language}
          item={item}
          targets={props.targets}
        />
      ))}
    </ul>
  );
}
