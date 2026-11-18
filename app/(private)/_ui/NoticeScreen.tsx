"use client";

// One notice (issue 304): read it in each language, copy it in each place's format (the game's notice board,
// the game's mail, Discord; issue 345), or edit it. A language that may be out of date carries an "Out of
// date" tag, which opens the editor at that language; "Update from …" and "Keep as is" are there, behind the
// editor's save and its checks. Under the languages: "Publish to Discord" and the calendar link (D102), and
// at the foot "Delete notice" (D118).
// Review requests (D113): the open ones at the top, where "Edit and save" opens the editor for that request,
// and the "Review" section with "Ask for a review" before Discord.
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { chip } from "@/lib/brand/components/controls";
import { Tag } from "@/lib/brand/components/Tag";
import { fill } from "@/lib/copy";
import { discordPost, gameMail, gameNotice } from "@/lib/private/notice-formats";
import { NOTICE_LIMIT, type NoticeLanguage } from "@/lib/private/notice-rules";

import { CopyButton } from "./CopyButton";
import { LANGUAGE_NAME } from "./languages";
import type { NoticeCalendar } from "./notice-calendar";
import { Counter, OutOfDateTag, OverLimit } from "./NoticeBits";
import { NoticeCalendarLink } from "./NoticeCalendarLink";
import { NoticeDelete } from "./NoticeDelete";
import { NoticeEditor, type EditorProps } from "./NoticeEditor";
import { NoticePublish, type PublishProps } from "./NoticePublish";
import { AskSheet, ReviewRequests, ReviewSection, type ReviewProps } from "./NoticeReviews";

export interface ScreenProps extends Omit<EditorProps, "focus" | "onClose" | "id"> {
  id: number;
  /** Server-made lines: who wrote it and who changed it last, and the members flag and end date. */
  meta: { written: string; changed: string; flags: string[] };
  publish: PublishProps["publish"];
  calendar: NoticeCalendar;
  reviews: ReviewProps;
}

/**
 * The three copies of one language: the game's notice board (cut to fit), the game's mail, Discord. Each
 * button has one line under it, always shown, that says what it copies (D116).
 */
export function Copies(p: {
  t: ScreenProps["t"];
  viewer: ScreenProps["viewer"];
  language: NoticeLanguage;
  title: string;
  text: string;
}) {
  const { t, language, text } = p;
  const board = gameNotice(text);
  const words = (copy: string, copied = t["members.copied"]) => ({
    copy,
    copied,
    failed: t["members.copyFailed"],
  });
  const limit = new Intl.NumberFormat(p.viewer).format(NOTICE_LIMIT);
  const copies = [
    {
      id: "notice",
      text: board.text,
      labels: words(
        t["notices.copy.notice"],
        board.cut ? fill(t["notices.copied.cut"], { limit: NOTICE_LIMIT }) : undefined,
      ),
      help: fill(t["notices.copy.notice.help"], { limit }),
    },
    {
      id: "mail",
      text: gameMail(text),
      labels: words(t["notices.copy.mail"]),
      help: t["notices.copy.mail.help"],
    },
    {
      id: "discord",
      text: discordPost(p.title, text),
      labels: words(t["notices.copy.discord"]),
      help: t["notices.copy.discord.help"],
    },
  ];
  return (
    <ul className="mt-3 grid gap-3 sm:grid-cols-3">
      {copies.map((c) => {
        const id = `copy-${language}-${c.id}`;
        return (
          <li key={c.id} className="flex flex-col items-start gap-1">
            <CopyButton text={c.text} labels={c.labels} describedBy={id} />
            <p id={id} className="text-body-sm text-ink/75">
              {c.help}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function LanguageText({
  p,
  language,
  onEdit,
  onAsk,
}: {
  p: ScreenProps;
  language: NoticeLanguage;
  onEdit: () => void;
  /** "Ask for a review" of this language (D113). */
  onAsk: () => void;
}) {
  const { t } = p;
  const field = p.fields[language];
  const name = LANGUAGE_NAME[language];
  return (
    <section aria-labelledby={`read-${language}`} className="mt-5 border-t border-rule pt-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex flex-wrap items-center gap-2">
          <h2 id={`read-${language}`} className="font-subhead text-display-sm">
            {name}
          </h2>
          {p.stale.includes(language) && (
            <OutOfDateTag
              label={fill(t["notices.outOfDate.aria"], { lang: name })}
              onOpen={onEdit}
              t={t}
            />
          )}
          {p.reviews.open.some((r) => r.language === language) && (
            <Tag tone="attention">{t["notices.review.waiting"]}</Tag>
          )}
        </span>
        <Counter text={field.value} t={t} language={p.viewer} />
      </div>
      {field.value === "" ? (
        <p className="mt-2 text-ink/70">{t["notices.missing"]}</p>
      ) : (
        <>
          <div lang={language} translate="no" className="mt-2 break-words whitespace-pre-wrap">
            {field.value}
          </div>
          <OverLimit text={field.value} t={t} language={p.viewer} />
          <Copies
            t={t}
            viewer={p.viewer}
            language={language}
            title={p.fields.title.value}
            text={field.value}
          />
          <button type="button" aria-haspopup="dialog" onClick={onAsk} className={`${chip()} mt-2`}>
            {t["notices.review.ask"]}
          </button>
        </>
      )}
    </section>
  );
}

export function NoticeScreen(p: ScreenProps) {
  /** null: reading. A language: editing, opened at it. true: editing from the top. */
  const [editing, setEditing] = useState<NoticeLanguage | true | null>(null);
  /** The review request the editor was opened from, if any (D113). */
  const [review, setReview] = useState<number | undefined>(undefined);
  /** The ask sheet: false when closed, else the language it opened with (null: the whole notice). */
  const [asking, setAsking] = useState<NoticeLanguage | null | false>(false);
  const { t } = p;
  const written = p.languages.filter((l) => p.fields[l].value.trim() !== "");
  if (editing) {
    return (
      <>
        <h1 className="font-display text-display-lg">{t["notices.edit.title"]}</h1>
        <NoticeEditor
          {...p}
          focus={editing === true ? undefined : editing}
          review={review}
          onClose={() => {
            setEditing(null);
            setReview(undefined);
          }}
        />
      </>
    );
  }
  return (
    <>
      <h1 className="font-display text-display-lg break-words">{p.fields.title.value}</h1>
      <p className="mt-2 text-body-sm text-ink/80">{p.meta.written}</p>
      <p className="text-body-sm text-ink/80">{p.meta.changed}</p>
      <ul className="mt-2 flex flex-wrap gap-x-3">
        {p.meta.flags.map((flag) => (
          <li key={flag}>
            <Tag>{flag}</Tag>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={buttonClass("secondary", "mt-4")}
      >
        {t["notices.edit"]}
      </button>
      <ReviewRequests
        slug={p.slug}
        t={t}
        reviews={p.reviews}
        onEdit={(id, language) => {
          setReview(id);
          setEditing(language ?? true);
        }}
      />
      {p.languages.map((language) => (
        <LanguageText
          key={language}
          p={p}
          language={language}
          onEdit={() => setEditing(language)}
          onAsk={() => setAsking(language)}
        />
      ))}
      <ReviewSection t={t} reviews={p.reviews} onAsk={() => setAsking(null)} />
      {asking !== false && (
        <AskSheet
          slug={p.slug}
          id={p.id}
          t={t}
          officers={p.reviews.officers}
          written={written}
          initial={asking}
          onClose={() => setAsking(false)}
        />
      )}
      <NoticePublish slug={p.slug} id={p.id} t={t} publish={p.publish} written={written} />
      <NoticeCalendarLink slug={p.slug} id={p.id} t={t} calendar={p.calendar} />
      <NoticeDelete slug={p.slug} id={p.id} title={p.fields.title.value} t={t} />
    </>
  );
}
