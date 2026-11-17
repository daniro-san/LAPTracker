"use client";

// The Calendar tab's week, day by day (issue 300): every entry with its server time (ST) and the officer's
// own time, its tags and an Edit button; "Add an event" opens the same sheet empty. This week opens at
// today, and entries already started are greyed. The page reads again when it comes back into view (owner
// rule, issue 293: freshness without realtime).
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { chip } from "@/lib/brand/components/controls";
import { Tag } from "@/lib/brand/components/Tag";
import { fill } from "@/lib/copy";
import { mondayOf } from "@/lib/private/calendar-time";

import type { AgendaDay, AgendaItem, CalendarSheetWords } from "./calendar-data";
import { EntryForm, type FormProps } from "./EntryForm";
import { Times } from "./YourTime";

/** Reads the page again when the officer comes back to it (another app, another tab). */
export function useFreshOnReturn() {
  const router = useRouter();
  useEffect(() => {
    const back = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, [router]);
}

let loadedAt: number | null = null;
const subscribe = () => () => {};
/** When the page loaded in the browser; null on the server and during hydration (no mismatch). */
const useLoadedAt = () =>
  useSyncExternalStore(
    subscribe,
    () => (loadedAt ??= Date.now()),
    () => null,
  );

/** The caravan's roles, or "Choose roles ›" to that week's caravans while none is chosen. */
function Roles({
  item,
  words,
  slug,
}: {
  item: AgendaItem;
  words: CalendarSheetWords;
  slug: string;
}) {
  if (item.roles) return <p className="text-body-sm">{item.roles}</p>;
  if (item.form.kind !== "caravan") return null;
  return (
    <a
      href={`/w/${slug}/calendar/caravans?week=${mondayOf(item.day)}#car-${item.key}`}
      className="inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4"
    >
      {words["calendar.roles.choose"]}
    </a>
  );
}

function Item(props: {
  item: AgendaItem;
  words: CalendarSheetWords;
  slug: string;
  onEdit: () => void;
}) {
  const { item, words } = props;
  const now = useLoadedAt();
  const past = now !== null && item.at !== null && item.at < now;
  return (
    <li className={`flex items-start gap-3 border-t border-rule py-3 ${past ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1">
        {item.st && item.at !== null && (
          <p className="text-body-sm">
            <Times st={item.st} at={item.at} day={item.day} words={words} />
          </p>
        )}
        <p className="font-semibold">{item.title}</p>
        <Roles item={item} words={words} slug={props.slug} />
        {item.notes && <p className="text-body-sm whitespace-pre-line text-ink/85">{item.notes}</p>}
        {item.notice && (
          <a
            href={`/w/${props.slug}/notices/${item.notice.id}`}
            className="inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4"
          >
            {fill(words["calendar.notice"], { title: item.notice.title })}
          </a>
        )}
        {item.link && (
          <a
            href={item.link}
            target="_blank"
            rel="noreferrer nofollow"
            className="inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4"
          >
            {words["calendar.link"]}
          </a>
        )}
        {item.tags.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-x-3">
            {item.tags.map((tag) => (
              <li key={tag}>
                <Tag>{tag}</Tag>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={props.onEdit}
        aria-label={fill(words["calendar.editOf"], { title: item.title })}
        className={`${chip()} min-w-11 shrink-0 justify-center font-semibold text-plum`}
      >
        {words["calendar.edit"]}
      </button>
    </li>
  );
}

function Day(props: {
  d: AgendaDay;
  words: CalendarSheetWords;
  slug: string;
  onEdit: (item: AgendaItem) => void;
}) {
  const { d, words } = props;
  return (
    <li id={`d-${d.day}`} className="scroll-mt-4 pt-3">
      <h2 className="font-subhead text-display-sm">
        {d.head}
        {d.today && (
          <span className="text-body-sm font-semibold text-plum">{` · ${words["calendar.today"]}`}</span>
        )}
      </h2>
      {d.duel && (
        <p className="text-body-sm text-ink/70">
          {fill(words["calendar.duelDay"], { theme: d.duel })}
        </p>
      )}
      {d.items.length === 0 ? (
        <p className="border-t border-rule py-3 text-body-sm text-ink/70">
          {words["calendar.nothing"]}
        </p>
      ) : (
        <ul>
          {d.items.map((item) => (
            <Item
              key={item.key}
              item={item}
              words={words}
              slug={props.slug}
              onEdit={() => props.onEdit(item)}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CalendarAgenda(props: {
  days: AgendaDay[];
  theme: AgendaItem | null;
  words: CalendarSheetWords;
  slug: string;
  zone: string;
  /** The workspace's notices, for the sheet's "Notice" choice (D102). */
  notices: FormProps["notices"];
  /** The day "Add an event" starts on: today in this week, else its Monday. */
  addDay: string;
}) {
  const { words } = props;
  const router = useRouter();
  const [open, setOpen] = useState<FormProps["mode"] | null>(null);
  useFreshOnReturn();
  // This week opens at today (its #d-<day> anchor), unless the address already names a place.
  const today = props.days.find((d) => d.today)?.day;
  useEffect(() => {
    if (today && !window.location.hash) document.getElementById(`d-${today}`)?.scrollIntoView();
  }, [today]);
  const done = () => {
    setOpen(null);
    router.refresh();
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen({ add: true, day: props.addDay, hasTheme: props.theme !== null })}
        className={buttonClass("primary", "mt-4 w-full sm:w-auto")}
      >
        {words["calendar.add"]}
      </button>
      {props.theme && (
        <ul className="mt-4">
          <Item
            item={props.theme}
            words={words}
            slug={props.slug}
            onEdit={() => setOpen({ add: false, item: props.theme as AgendaItem })}
          />
        </ul>
      )}
      <ol className="mt-4">
        {props.days.map((d) => (
          <Day
            key={d.day}
            d={d}
            words={words}
            slug={props.slug}
            onEdit={(item) => setOpen({ add: false, item })}
          />
        ))}
      </ol>
      {open && (
        <EntryForm
          words={words}
          slug={props.slug}
          zone={props.zone}
          notices={props.notices}
          mode={open}
          onDone={done}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
