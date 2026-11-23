// /w/[slug]/members (issues 296, 337): the alliance's members from its newest end-of-day read (D72), thanks
// first, then the list: compact rows, Check in and Needs help first, an instant search, filters and orders
// (D98). The access check runs before anything is read (D71). The page sends each member's row once; the
// list filters and orders them in the browser, and a member's details are read when their sheet opens.
// Above the list, new members added by hand wait for the roster (D106; the page first matches them to
// the newest roster); `?view=former` shows former members instead (D107). Laid out as list and detail
// (D122): the open member is in the address (`?m=`) and beside the list from 1024; the page head holds
// "Paste updates" and "Add a new member" (More on a phone).
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { PageHead } from "@/lib/brand/components/layout/PageHead";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { requireWorkspace, type WorkspaceAccess } from "@/lib/private/access";
import { clockIn } from "@/lib/private/calendar-time";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { channelNames } from "@/lib/private/discord-webhooks";
import { LANGUAGES } from "@/lib/private/fact-fields";
import { featureOn, thanksSwitches } from "@/lib/private/features";
import { followUpCounts, type WeekCounts } from "@/lib/private/follow-up";
import { formerMembers } from "@/lib/private/former-members";
import { toReviewCount } from "@/lib/private/import-view";
import type { Formats } from "@/lib/private/insights-format";
import { pickSetRef, setRefText, type SetRef } from "@/lib/private/insights-sets";
import { cardFormats } from "@/lib/private/member-card";
import {
  membersView,
  membersWithProgress,
  withListExtras,
  type ListSource,
  type MembersView,
} from "@/lib/private/members";
import { pickOrder, pickQuery } from "@/lib/private/members-list";
import { shownSet, type ShownSet } from "@/lib/private/members-set";
import { sheetHeader } from "@/lib/private/members-sheet";
import {
  dismissedMembers,
  matchOnRead,
  toMatch,
  type Pending,
} from "@/lib/private/pending-members";
import { RENEW_MS } from "@/lib/private/session";
import { SLUG } from "@/lib/private/sign-in";
import { serverDay } from "@/lib/schedule";
import { fill, plural } from "@/lib/words";

import { AllianceWeekLine, allianceWeekParts } from "../../../_ui/AllianceWeekLine";
import { CheckInLine, checkInLink } from "../../../_ui/CheckInLine";
import { editorWords, updatesWords } from "../../../_ui/facts-form";
import { FormerMembers } from "../../../_ui/FormerMembers";
import { SignedInFrame, workspaceWords } from "../../../_ui/Frame";
import {
  dismissedRow,
  formerRow,
  lifecycleWords,
  pendingRow,
  toMatchLine,
} from "../../../_ui/member-lifecycle-data";
import { listRow, listWords } from "../../../_ui/member-list-data";
import { MembersHead } from "../../../_ui/MembersHead";
import type { ListSet } from "../../../_ui/MembersListParts";
import { MembersRoster } from "../../../_ui/MembersRoster";
import { MembersSource } from "../../../_ui/MembersSource";
import { MembersThanks } from "../../../_ui/MembersThanks";
import { NoData } from "../../../_ui/NoData";
import { ActionButton, PageActions } from "../../../_ui/PageActions";
import { PasteUpdates } from "../../../_ui/PasteUpdates";
import type { PendingProps } from "../../../_ui/PendingMembers";
import { refuse } from "../../../_ui/refuse";
import { shareThanksProps, type ThanksSwitches } from "../../../_ui/share-thanks-data";

function Legend({ t }: { t: WorkspaceDictionary }) {
  return (
    <details className="mt-3 text-body-sm text-ink/80">
      <summary className="inline-flex min-h-11 cursor-pointer items-center py-2 font-semibold text-plum underline underline-offset-4">
        {t["members.more"]}
      </summary>
      <div className="space-y-1 pb-2">
        <p>{t["members.checkinHelp"]}</p>
        <p>{t["list.askHelp"]}</p>
        <p>
          <NoData label={t["nodata.mark"]} /> {t["members.nodataHelp"]}
        </p>
      </div>
    </details>
  );
}

/** The page's reads, after the access check: one view (members, or former members, D107). */
async function readPage(
  db: Parameters<typeof membersView>[0],
  p: {
    slug: string;
    jar: Parameters<typeof requireWorkspace>[2];
    now: Date;
    zone: string;
    showFormer: boolean;
    /** `?set=` (D158) and the words its title is written in. */
    set: SetRef | null;
    words: Formats;
  },
) {
  const { now, zone, showFormer } = p;
  const access = await requireWorkspace(db, p.slug, p.jar, now, RENEW_MS);
  if (!access.ok) return { access, waiting: 0, ...REFUSED };
  const env = getEnv();
  // Built by the same functions as the Insights count that linked here, for this workspace only; read
  // beside the members' own reads, not before them.
  const shown =
    p.set && !showFormer
      ? shownSet(db, access, p.set, p.words, {
          now,
          serverZone: zone,
          kvkWeekday: env.EVENT_WEEKDAY,
          kvkTime: env.EVENT_TIME,
        })
      : null;
  // D106: a roster read since a new member was added may now list them.
  const pending = await matchOnRead(db, access, now);
  const members = membersWithProgress(db, access, now, zone);
  const [view, channels, followUp, set] = await Promise.all([
    members,
    channelNames(db, access, getEnv()),
    // Issue 585: Follow-up's numbers for the head, as soon as the members view is in.
    showFormer ? null : members.then((v) => followUpCounts(db, access, v, now, zone)),
    shown,
  ]);
  return {
    access,
    waiting: await toReviewCount(db, access, now),
    view,
    set,
    // D126: the thanks sheet's switches.
    switches: { ...thanksSwitches(access), channel: channels.members },
    // The list's own read (photos and past names); the card route never runs it (issue 337).
    rows: showFormer ? [] : await withListExtras(db, access, view.members),
    followUp,
    lifecycle: showFormer
      ? { former: await formerMembers(db, access, zone, view.facts), pending: [], dismissed: [] }
      : {
          former: [],
          pending,
          dismissed: await dismissedMembers(db, access),
        },
  };
}

/** Refused: nothing is shown, so nothing is switched on. */
const NO_SWITCHES: ThanksSwitches = { board: false, writing: false, channel: null };
const REFUSED = {
  view: null,
  rows: [],
  lifecycle: null,
  switches: NO_SWITCHES,
  followUp: null,
  set: null,
};

/**
 * The editor's words, the add sheet saying when the nightly roster is read (D106), and whether "Read from a
 * screenshot" is there (D126: left out while reading screenshots is turned off for the alliance).
 */
const lifecycleEditor = (t: WorkspaceDictionary, readAt: string, access: WorkspaceAccess) => ({
  words: { ...editorWords(t), "pending.addHelp": fill(t["pending.addHelp"], { time: readAt }) },
  shots: featureOn(access, "ocr"),
});

/** The query's single values (a repeated key is left out). */
function plainSearch(query: Record<string, string | string[] | undefined>): URLSearchParams {
  return new URLSearchParams(
    Object.entries(query).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  );
}

/** "Import the old spreadsheets", at the end of the list's column, so nothing follows the list and its pane (D122). */
function ImportLink({ slug, t }: { slug: string; t: WorkspaceDictionary }) {
  return (
    <p className="mt-6">
      <a
        href={`/w/${slug}/import`}
        className="inline-flex min-h-11 items-center text-body-sm font-semibold text-plum underline underline-offset-4"
      >
        {t["members.import"]}
      </a>
    </p>
  );
}

/** The chip's words for an Insights set, and its members who have left (D158). */
function listSet(
  set: ShownSet,
  slug: string,
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
): ListSet {
  const n = set.former.length;
  return {
    kind: set.ref.kind,
    title: set.title,
    from: t["drill.set.from"],
    clear: t["drill.set.clear"],
    formerLine:
      n === 0
        ? null
        : fill(
            plural(
              n,
              { one: t["drill.set.former.one"], other: t["drill.set.former.other"] },
              language,
            ),
            { n },
          ),
    former: set.former.map((p) => ({ uid: p.uid, name: p.name })),
    slug,
  };
}

/** The page head's actions (D122): the page's one main action (D109), new values for several members at
 * once; then a new member (D106). Each opens its sheet, held once (PageActions). */
const headActions = (t: WorkspaceDictionary) => [
  {
    key: "paste",
    primary: true,
    node: <ActionButton id="paste-updates" label={t["updates.open"]} variant="primary" />,
  },
  {
    key: "add",
    node: <ActionButton id="add-member" label={t["pending.add"]} variant="secondary" />,
  },
];

/** New members waiting for the roster, the ones to match and the removed ones (D106). */
function pendingProps(
  view: MembersView,
  readAt: Date,
  lifecycle: { pending: Pending[]; dismissed: (Pending & { dismissedAt: Date })[] },
  t: WorkspaceDictionary,
  f: ReturnType<typeof cardFormats>,
  editor: PendingProps["editor"],
): PendingProps {
  return {
    rows: lifecycle.pending.map((p) => pendingRow(p, view.facts.get(p.uid) ?? {}, readAt, t, f)),
    toMatchLine: toMatchLine(toMatch(lifecycle.pending, readAt).length, t, f),
    dismissed: lifecycle.dismissed.map((p) => dismissedRow(p, view.facts.get(p.uid) ?? {}, t, f)),
    roster: view.members.map((m) => ({ uid: m.uid, name: m.name })),
    words: lifecycleWords(t),
    editor,
  };
}

export default async function MembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const jar = await cookies();
  const now = new Date();
  const env = getEnv();
  const search = plainSearch(await searchParams);
  const at = search.get("view") === "former" ? "former" : "members";
  const showFormer = at === "former";
  const { language, t } = await workspaceWords();
  // INVARIANT workspace.access-first: nothing private is read before this check.
  const { access, view, rows, waiting, lifecycle, switches, followUp, set } = await withPageDb(
    (db) =>
      readPage(db, {
        slug,
        jar,
        now,
        zone: env.SERVER_TZ,
        showFormer,
        set: pickSetRef(search.get("set")),
        words: { t, language },
      }),
  );
  if (!access.ok) {
    refuse(slug, access.reason, `/w/${slug}/members`);
    redirect(`/w/${slug}`);
  }
  if (!view || !lifecycle) notFound();
  const f = cardFormats(language, env.SERVER_TZ, now);
  const editor = {
    slug,
    ...lifecycleEditor(t, env.DAILY_ROSTER_AT, access),
    language,
    serverZone: env.SERVER_TZ,
    used: view.zones,
  };
  const roster = !showFormer && view.readAt !== null;
  // At the end of the list's column, so nothing follows the list and its pane (D122).
  const importLink = <ImportLink slug={slug} t={t} />;
  return (
    <SignedInFrame access={access} language={language} t={t} current={at} waiting={waiting} wide>
      <PageActions>
        <PageHead
          title={t["tab.members"]}
          actions={roster ? headActions(t) : []}
          moreLabel={t["desk.more"]}
        />
        <MembersHead access={access} former={showFormer} t={t} language={language} />
        {roster && <PasteUpdates slug={slug} words={updatesWords(t)} shots={editor.shots} />}
        {showFormer ? (
          <FormerMembers
            rows={lifecycle.former.map((m) => formerRow(m, t, f))}
            words={lifecycleWords(t)}
            editor={editor}
            initialOpen={search.get("m")}
            foot={importLink}
          />
        ) : view.readAt === null ? (
          <>
            <p className="drawn-card mt-4 px-4 py-5">{t["members.none"]}</p>
            {importLink}
          </>
        ) : (
          <Roster
            {...{ slug, view, rows, t, language, search, now, editor, switches, followUp, set }}
            foot={importLink}
            readAt={view.readAt}
            zone={env.SERVER_TZ}
            readHour={env.DAILY_ROSTER_AT}
            pending={pendingProps(view, view.readAt, lifecycle, t, f, editor)}
          />
        )}
      </PageActions>
    </SignedInFrame>
  );
}

/** The read's source and week, the thanks, the check-in line, the legend and the list. */
function Roster(props: {
  slug: string;
  view: MembersView;
  rows: ListSource[];
  readAt: Date;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  search: URLSearchParams;
  now: Date;
  zone: string;
  readHour: string;
  /** New members waiting for the roster (D106). */
  pending: PendingProps;
  editor: PendingProps["editor"];
  /** "Import the old spreadsheets", at the end of the list's column. */
  foot: ReactNode;
  /** D126: the thanks sheet's switches. */
  switches: ThanksSwitches;
  followUp: WeekCounts | null;
  /** The Insights set `?set=` names, built on the server; null without one. */
  set: ShownSet | null;
}) {
  const { slug, view, t, language, now, zone, set } = props;
  const f = cardFormats(language, zone, now);
  const today = serverDay(now, { SERVER_TZ: zone });
  const [from, to] = [view.week[0] ?? "", view.week[6] ?? ""];
  const share = shareThanksProps({ slug, t, language, view, today, switches: props.switches });
  const allianceWeek = allianceWeekParts(view, t, f, today);
  const lead = (
    <>
      <MembersSource
        t={t}
        early={view.early}
        readAt={f.time(props.readAt)}
        readHour={props.readHour}
      />
      <p className="mt-1 text-body-sm text-ink/80">
        {fill(t["members.week"], { from: f.date(from), to: f.date(to) })}
      </p>
      <AllianceWeekLine parts={allianceWeek} className="mt-1 max-w-(--measure)" />
      <MembersThanks view={view} t={t} f={f} share={share} />
      {/* Before the first end-of-day read nothing is computed, so nothing is said about check-ins. */}
      <CheckInLine
        check={checkInLink(slug, view, props.followUp, t, f)}
        none={t["members.checkinNone"]}
        className={view.early ? "hidden" : "mt-3"}
      />
      <Legend t={t} />
    </>
  );
  return (
    <MembersRoster
      lead={lead}
      pending={props.pending}
      editor={props.editor}
      foot={props.foot}
      initialOpen={props.search.get("m")}
      pick={t["members.pick"]}
      list={{
        rows: props.rows.map((m) => listRow(m, t, f)),
        early: view.early,
        words: listWords(t),
        language,
        initialQuery: pickQuery(
          props.search,
          LANGUAGES,
          set && { ref: setRefText(set.ref), uids: set.uids },
        ),
        set: set && listSet(set, slug, t, language),
        initialOrder: pickOrder(props.search.get("order")),
        today,
        hour: Number(clockIn(now.getTime(), zone, today).time.slice(0, 2)),
        serverZone: zone,
        sheetHeader: sheetHeader(view.week, t),
        // Issue 585 S3: with Follow-up's numbers in the head (its tab on, D126), the list's first group points
        // at Follow-up instead of being a second count.
        followUp: props.followUp ? `/w/${slug}/follow-up` : null,
      }}
    />
  );
}
