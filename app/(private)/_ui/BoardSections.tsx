// The members' board's sections (D105, issue 331), rendered on the server: this week's member-marked Calendar
// entries on the viewer's clock with server time beside them, the notices marked for members, and Start here.
// Texts written in several languages show the viewer's first, the others one tap away.
import type { ReactNode } from "react";

import { fill, isolate } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { BOARD_DAYS, type BoardEntry, type BoardNotice } from "@/lib/private/board";
import { addDays, zonedInstant } from "@/lib/private/calendar-time";
import { calendarDates, stOf, titleOf } from "@/lib/private/calendar-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { NOTICE_LANGUAGES, type NoticeLanguage } from "@/lib/private/notice-rules";
import type { StartHereText } from "@/lib/private/start-here";

import { BoardTime, LanguageTabs, type LanguagePanel } from "./BoardParts";
import { calendarWords } from "./calendar-data";
import { LANGUAGE_CODE, LANGUAGE_NAME } from "./languages";

export const LINK =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";
const TEXT = "break-words whitespace-pre-wrap";

/** The written languages, the viewer's first, then the others in the usual order. */
function inOrder(written: readonly string[], language: WorkspaceLanguage): NoticeLanguage[] {
  return NOTICE_LANGUAGES.filter((l) => written.includes(l)).sort(
    (a, b) => Number(b === language) - Number(a === language),
  );
}

function Translated(props: {
  id: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  written: readonly string[];
  /** Languages that may be behind the newest: their panel says so first. */
  stale?: readonly NoticeLanguage[];
  body: (l: NoticeLanguage) => ReactNode;
}) {
  const { t, language, written } = props;
  const order = inOrder(written, language);
  const panels: LanguagePanel[] = order.map((l) => ({
    language: l,
    short: LANGUAGE_CODE[l],
    name: LANGUAGE_NAME[l],
    body: props.stale?.includes(l) ? (
      <>
        <p className="mt-1 text-body-sm font-semibold text-yarn">{t["board.stale"]}</p>
        {props.body(l)}
      </>
    ) : (
      props.body(l)
    ),
  }));
  return (
    <>
      {!written.includes(language) && order.length > 0 && (
        <p className="mt-1 text-body-sm text-ink/75">{t["board.notInYours"]}</p>
      )}
      <LanguageTabs id={props.id} label={t["board.read"]} panels={panels} />
    </>
  );
}

function Entry(props: {
  item: BoardEntry;
  t: WorkspaceDictionary;
  zone: string;
  notices: Map<number, string>;
}) {
  const { item, t, zone } = props;
  const { entry } = item;
  const title = props.notices.get(item.noticeId ?? -1);
  return (
    <li className="border-t border-rule py-2 first:border-t-0">
      <p className="font-semibold">{titleOf(entry, t)}</p>
      {item.minute !== null && (
        <p>
          <BoardTime
            st={stOf(entry.kind, item.minute, t)}
            at={zonedInstant(item.day, item.minute, zone)}
            day={item.day}
            words={calendarWords(t)}
          />
        </p>
      )}
      {entry.notes && <p className={`mt-1 ${TEXT}`}>{entry.notes}</p>}
      {entry.link && (
        <a href={entry.link} target="_blank" rel="noopener noreferrer" className={LINK}>
          {t["board.link"]}
        </a>
      )}
      {title !== undefined && (
        <p>
          <a href={`#notice-${item.noticeId}`} className={LINK}>
            {fill(t["board.notice"], { title: isolate(title) })}
          </a>
        </p>
      )}
    </li>
  );
}

export function Week(props: {
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  today: string;
  entries: BoardEntry[];
  notices: BoardNotice[];
}) {
  const { t, language, today, entries } = props;
  const zone = getEnv().SERVER_TZ;
  const dates = calendarDates(language);
  const titles = new Map(props.notices.map((n) => [n.id, n.title]));
  // This week's Alliance Duel theme, whose Monday may have passed, goes above the days.
  const theme = entries.find((e) => e.entry.kind === "duel" && e.day < today);
  const days = Array.from({ length: BOARD_DAYS }, (_, i) => addDays(today, i))
    .map((day) => ({ day, items: entries.filter((e) => e.day === day) }))
    .filter((d) => d.items.length > 0);
  return (
    <section aria-labelledby="board-week" className="mt-5">
      <h2 id="board-week" className="font-subhead text-display-sm">
        {t["board.week"]}
      </h2>
      {theme && <p className="mt-1 font-semibold">{titleOf(theme.entry, t)}</p>}
      {days.length === 0 ? (
        <p className="mt-1">{t["board.week.none"]}</p>
      ) : (
        <>
          <p className="mt-1 text-body-sm text-ink/75">{t["board.times"]}</p>
          {days.map(({ day, items }) => (
            <div key={day} className="mt-3 border border-rule px-4 py-2">
              <h3 className="font-semibold">
                {dates.long(day)}
                {day === today && <span className="text-plum">{` · ${t["board.today"]}`}</span>}
              </h3>
              <ul>
                {items.map((item) => (
                  <Entry key={item.key} item={item} t={t} zone={zone} notices={titles} />
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

export function Notices(props: {
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  notices: BoardNotice[];
}) {
  const { t, language, notices } = props;
  const dates = calendarDates(language);
  return (
    <section aria-labelledby="board-notices" className="mt-6">
      <h2 id="board-notices" className="font-subhead text-display-sm">
        {t["board.notices"]}
      </h2>
      {notices.length === 0 && <p className="mt-1">{t["board.notices.none"]}</p>}
      {notices.map((n) => (
        <article
          key={n.id}
          id={`notice-${n.id}`}
          aria-labelledby={`notice-${n.id}-title`}
          className="mt-3 scroll-mt-4 border border-rule px-4 py-3"
        >
          <h3 id={`notice-${n.id}-title`} translate="no" className="font-semibold">
            {n.title}
          </h3>
          <p className="text-body-sm text-ink/75">
            {n.endsOn
              ? fill(t["notices.until"], { date: dates.short(n.endsOn) })
              : t["board.noEnd"]}
          </p>
          <Translated
            id={`notice-${n.id}`}
            t={t}
            language={language}
            written={Object.keys(n.texts)}
            stale={n.stale}
            body={(l) => (
              <p translate="no" className={`mt-1 ${TEXT}`}>
                {n.texts[l]}
              </p>
            )}
          />
        </article>
      ))}
    </section>
  );
}

export function StartHere(props: {
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  texts: Partial<Record<NoticeLanguage, StartHereText>>;
  channel: string | null;
  guildId: string;
}) {
  const { t, texts, channel } = props;
  const written = NOTICE_LANGUAGES.filter((l) => {
    const x = texts[l];
    return x !== undefined && (x.glossary || x.rules || x.ask) !== "";
  });
  const parts = [
    ["glossary", "board.start.glossary"],
    ["rules", "board.start.rules"],
    ["ask", "board.start.ask"],
  ] as const;
  return (
    <section aria-labelledby="board-start" className="mt-6 border border-rule px-4 py-3">
      <h2 id="board-start" className="font-subhead text-display-sm">
        {t["board.start"]}
      </h2>
      {written.length === 0 ? (
        <p className="mt-1">{t["board.start.none"]}</p>
      ) : (
        <Translated
          id="start"
          t={t}
          language={props.language}
          written={written}
          body={(l) =>
            parts.map(([part, head]) =>
              texts[l]?.[part] ? (
                <div key={part} className="mt-2">
                  <h3 className="font-semibold">{t[head]}</h3>
                  <p translate="no" className={TEXT}>
                    {texts[l]?.[part]}
                  </p>
                </div>
              ) : null,
            )
          }
        />
      )}
      {channel && (
        <p className="mt-3">
          {fill(t["board.discord"], { channel })}{" "}
          <a
            href={`https://discord.com/channels/${props.guildId}`}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK}
          >
            {t["board.discord.open"]}
          </a>
        </p>
      )}
    </section>
  );
}
