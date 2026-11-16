"use client";

// The Calendar tab's week, day by day (issue 300): every entry with its server time (ST) and the officer's
// own time, its tags and an Edit button; "Add an event" opens the same sheet empty. The page reads again
// when it comes back into view (owner rule, issue 293: freshness without realtime).
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import type { CalendarWords } from "@/lib/private/dictionary.calendar";

import type { AgendaDay, AgendaItem } from "./calendar-data";
import { EntryForm, type FormProps } from "./EntryForm";
import { YourTime } from "./YourTime";

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

function Item({
  item,
  words,
  onEdit,
}: {
  item: AgendaItem;
  words: CalendarWords;
  onEdit: () => void;
}) {
  return (
    <li className="flex items-start gap-3 border-t border-rule py-3">
      <div className="min-w-0 flex-1">
        {item.st && item.at !== null && (
          <p className="text-body-sm">
            <span className="font-bold tabular-nums">{item.st}</span>
            <span className="text-ink/75">
              {" · "}
              <YourTime at={item.at} day={item.day} words={words} />
            </span>
          </p>
        )}
        <p className="font-semibold">{item.title}</p>
        {item.roles && <p className="text-body-sm">{item.roles}</p>}
        {item.notes && <p className="text-body-sm whitespace-pre-line text-ink/85">{item.notes}</p>}
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
          <ul className="mt-1 flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <li key={tag} className="border border-rule px-1.5 text-[12px] leading-5 text-ink/80">
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={words["calendar.editOf"].replace("{title}", item.title)}
        className="min-h-11 min-w-11 shrink-0 border border-rule px-3 text-body-sm font-semibold"
      >
        {words["calendar.edit"]}
      </button>
    </li>
  );
}

export function CalendarAgenda(props: {
  days: AgendaDay[];
  theme: AgendaItem | null;
  words: CalendarWords;
  slug: string;
  zone: string;
  /** The day "Add an event" starts on: today in this week, else its Monday. */
  addDay: string;
}) {
  const { words } = props;
  const router = useRouter();
  const [open, setOpen] = useState<FormProps["mode"] | null>(null);
  useFreshOnReturn();
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
            onEdit={() => setOpen({ add: false, item: props.theme as AgendaItem })}
          />
        </ul>
      )}
      <ol className="mt-4">
        {props.days.map((d) => (
          <li key={d.day} id={`d-${d.day}`} className="scroll-mt-4 pt-3">
            <h2 className="font-subhead text-display-sm">
              {d.head}
              {d.today && (
                <span className="text-body-sm font-semibold text-plum">{` · ${words["calendar.today"]}`}</span>
              )}
            </h2>
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
                    onEdit={() => setOpen({ add: false, item })}
                  />
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      {open && (
        <EntryForm
          words={words}
          slug={props.slug}
          zone={props.zone}
          mode={open}
          onDone={done}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
