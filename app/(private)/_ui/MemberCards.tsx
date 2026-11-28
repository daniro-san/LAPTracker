"use client";

// A member's card (issue 296), shown in the Members list's sheet (issue 337): the server makes its words
// (lib/private/member-card.ts) and this lays them out. Issue 461 (D136): a short header (the status when it
// says something, the stat strip, their time and languages, where they came from) over four tabs, so no
// view is a long scroll: Overview (the reasons, the last 7 days, this week's Alliance Duel), Info (the
// officers' member facts with their sources and the details, two columns from 768), Squads (D117) and
// History (follow-up notes, earlier values). "Edit info" and "Paste what they told you" sit in the sheet's
// sticky bar (factsActions) and open the editor whatever the tab. Nothing is hover-only.
import { useState } from "react";

import { chip } from "@/lib/brand/components/controls";
import type { SheetAction } from "@/lib/brand/components/Sheet";
import { Tag } from "@/lib/brand/components/Tag";
import type { CardData } from "@/lib/private/member-card";
import { fill } from "@/lib/words";

import { CardFollowUp } from "./CardFollowUp";
import { SOURCE_KEY } from "./facts-form";
import { FactsEditor, type EditorProps } from "./FactsEditor";
import { LANGUAGE_NAME } from "./languages";
import {
  CardTabs,
  Details,
  History,
  MapPosition,
  panelId,
  tabId,
  useCardTab,
} from "./MemberCardTabs";
import { MemberLastDays } from "./MemberLastDays";
import { CardLink } from "./MemberLinks";
import { MemberSquads } from "./MemberSquads";
import { withNoData } from "./NoData";
import { SelfReportCard, SelfReportInfo } from "./SelfReportCard";

export const STATUS_TONE = {
  help: "font-semibold text-yarn",
  break: "font-semibold text-sage",
  checkin: "font-semibold text-yarn",
  new: "font-semibold text-plum",
  nodata: "text-ink/70",
  fine: "text-ink/70",
  none: "",
} as const;

/** What every card's editor shares: the workspace, the words, the server's zone, the zones in use. */
export type EditorContext = Pick<
  EditorProps,
  "slug" | "words" | "shots" | "language" | "serverZone" | "used"
>;

/** Which way into the facts editor is open, if any. */
export type FactsMode = "edit" | "paste" | null;

/** The editor's mode, held by the sheet that shows the facts, and how to close it. */
type Editing = { mode: FactsMode; onEditorClose: () => void };

/**
 * The card, its editor's shared context, "their time now 22:33" for the time-zone line, and how to read
 * the card again after a Follow-up save (issue 516).
 */
type CardProps = {
  card: CardData;
  editor: EditorContext;
  zoneNow: string | null;
  onChanged?: (() => void) | undefined;
} & Editing;

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
export type FactsCard = Pick<
  CardData,
  "uid" | "name" | "factLines" | "stored" | "autoStatus" | "noData" | "selfReport"
>;

/** The facts editor, a sheet of its own, while the sheet's bar has it open. */
function Editor({
  card,
  editor,
  mode,
  onEditorClose,
}: { card: FactsCard; editor: EditorContext } & Editing) {
  if (!mode) return null;
  return (
    <FactsEditor
      {...editor}
      uid={card.uid}
      name={card.name}
      facts={card.stored}
      autoStatus={card.autoStatus}
      mode={mode}
      onClose={onEditorClose}
    />
  );
}

/**
 * The member facts with their sources. `dates` shows when Main squad and AD Tech were saved; `grid` lays
 * them in two columns from 768 (the member card's Info tab), label over value.
 */
function FactList({
  card,
  editor,
  zoneNow,
  dates,
  grid,
}: {
  card: FactsCard;
  editor: EditorContext;
  zoneNow: string | null;
  dates: boolean;
  grid?: boolean;
}) {
  const { words } = editor;
  return (
    <dl className={`mt-1 text-body-sm ${grid ? "md:grid md:grid-cols-2 md:gap-x-4" : ""}`}>
      {card.factLines.map((l) => (
        <div
          key={l.field}
          className={`border-t border-rule py-2 ${grid ? "md:block" : ""} flex justify-between gap-3`}
        >
          <dt className="shrink-0 text-ink/75">{l.label}</dt>
          <dd
            className={`min-w-0 text-right break-words whitespace-pre-line ${grid ? "md:text-left" : ""}`}
          >
            <span className="tabular-nums">{withNoData(l.value, card.noData)}</span>
            {/* D109: the change since the version before, on its own muted line. */}
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
            {dates && l.updated && (
              <span className="block text-[12px] text-ink/70">{l.updated}</span>
            )}
            {/* D154: what the member said, seen by an officer and not what the card holds. */}
            <SelfReportInfo text={card.selfReport?.info[l.field as "adTech"]} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

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
  return (
    <section className="mt-3 border-t border-rule pt-3">
      <h3 className="text-body-sm font-semibold">{editor.words["facts.head"]}</h3>
      <FactList card={card} editor={editor} zoneNow={zoneNow} dates />
      <Editor card={card} editor={editor} mode={mode} onEditorClose={onEditorClose} />
    </section>
  );
}

const SHIELD_TONE = { plain: "", attention: "text-yarn", muted: "text-ink/75" } as const;

/**
 * Issue 634: the Raid Shield block, only from Friday's night check until KvK starts. Raid prep's words; the
 * map scan's time in brackets kept whole, so it wraps as a unit at 360 px. Never in replay (D137).
 */
function ShieldBlock({ shield }: { shield: NonNullable<CardData["shield"]> }) {
  return (
    <div className="ph-no-capture mt-1 text-body-sm">
      <p className="font-semibold">{shield.head}</p>
      {shield.lines.map((l) => (
        <p key={l.text} className={SHIELD_TONE[l.tone]}>
          {l.text}
          {l.scan && (
            <span className="text-label whitespace-nowrap text-ink/75">{` (${l.scan})`}</span>
          )}
        </p>
      ))}
    </div>
  );
}

/**
 * Status, the Raid Shield block during the raid (issue 634), the stat strip, their time and languages,
 * where they came from and who on Discord is linked to them (D142): the same on every tab.
 */
function Header({ card, zoneNow, editor, onChanged }: CardProps) {
  const { slug } = editor;
  return (
    <div className="px-3 pb-3">
      {card.statusLabel && (
        <p className="text-body-sm">
          <span className={STATUS_TONE[card.status]}>{card.statusLabel}</span>
        </p>
      )}
      {/* Since when, who added the Needs help mark and their note (issue 585 S2); never in replay (issue 549). */}
      {card.statusMark.map((line, i) => (
        <p key={i} className="ph-no-capture text-body-sm text-ink/80">
          {line}
        </p>
      ))}
      {card.shield && <ShieldBlock shield={card.shield} />}
      <p className="flex flex-wrap gap-x-3 text-body-sm tabular-nums">
        {card.facts.map((f) => (
          <span
            key={f.text}
            className="inline-block whitespace-nowrap"
            {...(f.game && { translate: "no" as const })}
          >
            {withNoData(f.text, card.noData)}
          </span>
        ))}
      </p>
      {(zoneNow || card.languages.length > 0) && (
        <p className="mt-1 flex flex-wrap items-baseline gap-x-3 text-body-sm">
          {zoneNow && <span className="text-ink/75 tabular-nums">{zoneNow}</span>}
          {card.languages.map((code) => (
            <Tag key={code}>{code}</Tag>
          ))}
        </p>
      )}
      {card.origin.map((line) => (
        <p key={line} className="mt-1 text-body-sm text-ink/80">
          {line}
        </p>
      ))}
      {card.gameLanguage && (
        <p className="mt-1 text-body-sm text-ink/80">
          {fill(card.gameLanguage.line, {
            name: card.gameLanguage.language
              ? LANGUAGE_NAME[card.gameLanguage.language]
              : card.gameLanguage.other,
            date: card.gameLanguage.date,
          })}
        </p>
      )}
      {card.link && <CardLink slug={slug} link={card.link} words={card.link.words} />}
      <SelfReportCard
        slug={slug}
        uid={card.uid}
        report={card.selfReport}
        onChanged={onChanged}
        failed={editor.words?.["facts.failed"] ?? ""}
      />
    </div>
  );
}

function Overview({ card, editor, onChanged }: CardProps) {
  return (
    <>
      {card.statusLines.length > 0 && (
        // ph-no-capture (issue 549): "No daily quests on {day}" and the other reasons never reach replay.
        <ul className="ph-no-capture mt-3 text-body-sm">
          {card.statusLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {/* Issue 516: this week's follow-up, Talked and the ready message, without leaving the card. */}
      {card.followUp && (
        <CardFollowUp
          slug={editor.slug}
          uid={card.uid}
          data={card.followUp}
          onChanged={onChanged}
        />
      )}
      {card.days ? (
        // ph-no-capture (issue 549): session replay records the bars as an empty box, so no bar height or
        // daily number of the member reaches analytics.
        <div className="ph-no-capture">
          <MemberLastDays days={card.days} />
        </div>
      ) : (
        <p className="mt-3 text-body-sm text-ink/75">{card.daysEarly}</p>
      )}
      {card.duel && <Details rows={[card.duel]} noData={card.noData} />}
    </>
  );
}

function Info({ card, editor }: Pick<CardProps, "card" | "editor">) {
  const [dates, setDates] = useState(false);
  const dated = card.factLines.some((l) => l.updated);
  return (
    <>
      {card.toAsk && <p className="mt-3 text-body-sm">{card.toAsk}</p>}
      <section className="mt-3">
        <h3 className="text-body-sm font-semibold">{editor.words["facts.head"]}</h3>
        {/* "their time now" is in the header already. */}
        <FactList card={card} editor={editor} zoneNow={null} dates={dates} grid />
        {dated && (
          <button
            type="button"
            aria-pressed={dates}
            onClick={() => setDates((d) => !d)}
            className={`${chip(dates)} mt-1`}
          >
            {dates ? card.dates.hide : card.dates.show}
          </button>
        )}
      </section>
      <Details rows={card.details} noData={card.noData} />
      <MapPosition map={card.map} noData={card.noData} />
    </>
  );
}

/** The opened member: the header, then the four tabs and the open one's panel. */
export function MemberCard(props: CardProps) {
  const { card } = props;
  const [tab, setTab] = useCardTab();
  return (
    <>
      <Header {...props} />
      <CardTabs card={card} active={tab} onPick={setTab} />
      <div
        id={panelId(card.uid)}
        role="tabpanel"
        aria-labelledby={tabId(card.uid, tab)}
        tabIndex={0}
        className="px-3 pb-3"
      >
        {tab === "overview" && <Overview {...props} />}
        {tab === "info" && <Info card={card} editor={props.editor} />}
        {tab === "squads" && card.squads && <MemberSquads squads={card.squads} />}
        {tab === "history" && (
          <History card={card} slug={props.editor.slug} onChanged={props.onChanged} />
        )}
      </div>
      <Editor
        card={card}
        editor={props.editor}
        mode={props.mode}
        onEditorClose={props.onEditorClose}
      />
    </>
  );
}
