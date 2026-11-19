// The top of a roll call page (issue 298): back to the week's roll calls, the occasion's title, its day and
// time (ST and the officer's own), and for an Elixir Scramble team its two steps, Team and Roll call, as
// links (44 px, the open one marked).
import { Tag } from "@/lib/brand/components/Tag";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

import type { CalendarSheetWords } from "./calendar-data";
import { Times } from "./YourTime";

const LINK =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";

export function RollCallHead(props: {
  t: WorkspaceDictionary;
  times: CalendarSheetWords;
  backHref: string;
  title: string;
  dayLabel: string;
  day: string;
  st: string | null;
  at: number | null;
  /** The Elixir Scramble steps: hrefs, and which one is open. */
  steps: { team: string; call: string; open: "team" | "call" } | null;
  /** "Archived" under the day line (D120). */
  archived?: boolean;
}) {
  const { t, steps } = props;
  return (
    <>
      <p>
        <a href={props.backHref} className={LINK}>
          {`‹ ${t["roll.back"]}`}
        </a>
      </p>
      <h1 className="font-display text-display-lg">{props.title}</h1>
      <p className="text-body-sm">
        {props.dayLabel}
        {props.st && props.at !== null && (
          <>
            {" · "}
            <Times st={props.st} at={props.at} day={props.day} words={props.times} />
          </>
        )}
      </p>
      {props.archived && (
        <p className="mt-1">
          <Tag>{t["roll.archived"]}</Tag>
        </p>
      )}
      {steps && (
        <nav aria-label={t["roll.nav.aria"]} className="mt-2 border-b border-rule">
          <ul className="grid grid-cols-2">
            {(["team", "call"] as const).map((k) => (
              <li key={k}>
                <a
                  href={steps[k]}
                  aria-current={steps.open === k ? "page" : undefined}
                  className={`flex min-h-11 items-center justify-center border-b-[3px] ${
                    steps.open === k ? "border-plum font-semibold text-plum" : "border-transparent"
                  }`}
                >
                  {t[k === "team" ? "roll.nav.team" : "roll.nav.call"]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
