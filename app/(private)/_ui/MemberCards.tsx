"use client";

// A member's card (issue 296), shown in the Members list's sheet (issue 337): the server makes its words
// (lib/private/member-card.ts) and this lays them out: the status with its evidence, the game's numbers, the
// donations per day and the other details. The officers' member facts (issue 297) are listed with their
// source; "Edit info" and "Paste what they told you" sit in the sheet's sticky bar (factsActions) and open
// the editor. Nothing is hover-only.
import type { SheetAction } from "@/lib/brand/components/Sheet";
import type { CardData } from "@/lib/private/member-card";

import { SOURCE_KEY } from "./facts-form";
import { FactsEditor, type EditorProps } from "./FactsEditor";

export const STATUS_TONE = {
  help: "font-semibold text-yarn",
  break: "font-semibold text-sage",
  checkin: "font-semibold text-yarn",
  new: "font-semibold text-plum",
  nodata: "text-ink/70",
  fine: "text-ink/60",
  none: "",
} as const;

/** What every card's editor shares: the workspace, the words, the server's zone, the zones in use. */
export type EditorContext = Pick<
  EditorProps,
  "slug" | "words" | "language" | "serverZone" | "used"
>;

/** Which way into the facts editor is open, if any. */
export type FactsMode = "edit" | "paste" | null;

/** The editor's mode, held by the sheet that shows the facts, and how to close it. */
type Editing = { mode: FactsMode; onEditorClose: () => void };

/** The card, its editor's shared context, and "their time now 22:33" for the time-zone line. */
type CardProps = { card: CardData; editor: EditorContext; zoneNow: string | null } & Editing;

/** The sheet bar's two ways into the editor: "Edit info" the main action, "Paste what they told you" second. */
export function factsActions(
  words: EditorContext["words"],
  open: (mode: "edit" | "paste") => void,
): { primary: SheetAction; secondary: SheetAction } {
  return {
    // One line: at 360 px the longer second label wraps instead ("Colar o que a pessoa disse").
    primary: {
      label: <span className="whitespace-nowrap">{words["facts.edit"]}</span>,
      onClick: () => open("edit"),
    },
    secondary: { label: words["facts.paste"], onClick: () => open("paste") },
  };
}

/** What the facts section needs: also a pending or former member's (D106, D107), who have no card. */
export type FactsCard = Pick<CardData, "uid" | "name" | "factLines" | "stored" | "autoStatus">;

/** The member facts with their sources, and the editor while the sheet's bar has it open. */
export function Facts({
  card,
  editor,
  zoneNow,
  mode,
  onEditorClose,
}: {
  card: FactsCard;
  editor: EditorContext;
  zoneNow: string | null;
} & Editing) {
  const { words } = editor;
  return (
    <section className="mt-3 border-t border-rule pt-3">
      <h3 className="text-body-sm font-semibold">{words["facts.head"]}</h3>
      <dl className="mt-1 text-body-sm">
        {card.factLines.map((l) => (
          <div key={l.field} className="flex justify-between gap-3 border-t border-rule py-2">
            <dt className="shrink-0 text-ink/75">{l.label}</dt>
            <dd className="min-w-0 text-right break-words whitespace-pre-line">
              <span className="tabular-nums">{l.value}</span>
              {/* D109: the change since the version before, on its own muted line ("+400K since Nov 10",
                  "+5 points since Nov 10", "Complete"). */}
              {l.change && <span className="block text-ink/75 tabular-nums">{l.change}</span>}
              {l.field === "timeZone" && l.source && zoneNow && (
                <span className="block text-ink/75">{zoneNow}</span>
              )}
              {/* "Typed by an officer" is the default and says nothing; the others are plain words. */}
              {l.source && l.source !== "officer" && (
                <span className="ml-2 inline-block text-[12px] text-ink/70">
                  {words[SOURCE_KEY[l.source]]}
                </span>
              )}
              {/* When it was saved: plain information, never a warning (D109). */}
              {l.updated && <span className="block text-[12px] text-ink/70">{l.updated}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {mode && (
        <FactsEditor
          {...editor}
          uid={card.uid}
          name={card.name}
          facts={card.stored}
          autoStatus={card.autoStatus}
          mode={mode}
          onClose={onEditorClose}
        />
      )}
    </section>
  );
}

function Details({ card, editor, zoneNow, mode, onEditorClose }: CardProps) {
  return (
    <div className="border-t border-rule px-3 py-3">
      <p className="text-body-sm font-semibold">{card.donationsHead}</p>
      <ol className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[13px] leading-5 tabular-nums">
        {card.days.map((d) => (
          <li key={`${d.weekday}${d.day}`} aria-label={d.said} className="border border-rule py-1">
            <span aria-hidden="true" className="block whitespace-nowrap text-ink/70">
              {d.weekday}
            </span>
            <span aria-hidden="true" className="block whitespace-nowrap text-ink/70">
              {d.day}
            </span>
            <span
              aria-hidden="true"
              className={`block min-h-5 whitespace-nowrap ${d.none ? "text-ink/60" : ""}`}
            >
              {d.value}
            </span>
          </li>
        ))}
      </ol>
      <dl className="mt-3 text-body-sm">
        {card.details.map((d) => (
          <div
            key={d.label}
            className="flex justify-between gap-3 border-t border-rule py-2 first:border-t-0"
          >
            <dt className="text-ink/75">{d.label}</dt>
            <dd className="text-right tabular-nums">{d.value}</dd>
          </div>
        ))}
      </dl>
      <Facts
        card={card}
        editor={editor}
        zoneNow={zoneNow}
        mode={mode}
        onEditorClose={onEditorClose}
      />
    </div>
  );
}

/** The opened member: the status with its evidence and the game's numbers, then the details and facts. */
export function MemberCard(props: CardProps) {
  const { card } = props;
  return (
    <>
      <div className="px-3 pb-3">
        <p className="text-body-sm">
          <span className={STATUS_TONE[card.status]}>{card.statusLabel}</span>
          {card.statusLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 text-body-sm tabular-nums">
          {card.facts.map((f) => (
            <span
              key={f.text}
              className="inline-block whitespace-nowrap"
              {...(f.game && { translate: "no" as const })}
            >
              {f.text}
            </span>
          ))}
        </p>
        {card.followUps.lines.length > 0 && (
          <section className="mt-3 border-t border-rule pt-2">
            <h3 className="text-body-sm font-semibold">{card.followUps.head}</h3>
            <ul className="text-body-sm whitespace-pre-line">
              {card.followUps.lines.map((line, i) => (
                <li key={i} className="py-1">
                  {line}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <Details {...props} />
    </>
  );
}
