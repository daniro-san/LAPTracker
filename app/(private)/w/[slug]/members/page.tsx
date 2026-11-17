// /w/[slug]/members (issues 296, 337): the alliance's members from its newest end-of-day read (D72), thanks
// first, then the list: compact rows, Check in and Needs help first, an instant search, filters and orders
// (D98). The access check runs before anything is read (D71). The page sends each member's row once; the
// list filters and orders them in the browser, and a member's details are read when their sheet opens.
// Above the list, new members added by hand wait for the roster (D106; the page first matches them to
// the newest roster); `?view=former` shows former members instead (D107).
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { chip } from "@/lib/brand/components/controls";
import { fill } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { requireWorkspace } from "@/lib/private/access";
import { clockIn } from "@/lib/private/calendar-time";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { LANGUAGES } from "@/lib/private/fact-fields";
import { formerMembers } from "@/lib/private/former-members";
import { toReviewCount } from "@/lib/private/import-view";
import { cardFormats, progressText, type CardFormats } from "@/lib/private/member-card";
import {
  membersView,
  progressHistory,
  withListExtras,
  type ListSource,
  type MembersView,
} from "@/lib/private/members";
import { needsAWord, pickOrder, pickQuery, whoOf } from "@/lib/private/members-list";
import { plural, sheetHeader } from "@/lib/private/members-sheet";
import { dismissedMembers, matchOnRead, toMatch } from "@/lib/private/pending-members";
import { RENEW_MS } from "@/lib/private/session";
import { SLUG } from "@/lib/private/sign-in";
import { serverDay } from "@/lib/schedule";

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
import { MembersList } from "../../../_ui/MembersList";
import { MembersSource } from "../../../_ui/MembersSource";
import { PasteUpdates } from "../../../_ui/PasteUpdates";
import { PendingMembers } from "../../../_ui/PendingMembers";
import { refuse } from "../../../_ui/refuse";
import { TabSend } from "../../../_ui/ToReview";

/** Top donors and most active; then progress this week, in name order, not a ranking (D109). */
function Thanks({ view, t, f }: { view: MembersView; t: WorkspaceDictionary; f: CardFormats }) {
  const rows = (["donors", "activity"] as const).filter((k) => view.thanks[k].length > 0);
  const progress = view.thanks.progress;
  if (rows.length === 0 && progress.length === 0) return null;
  return (
    <section aria-labelledby="thanks" className="mt-4 border border-rule px-4 py-3">
      <h2 id="thanks" className="font-subhead text-display-sm">
        {t["thanks.head"]}
      </h2>
      <p className="text-body-sm">{t["thanks.intro"]}</p>
      <div className="mt-2 grid grid-cols-2 gap-x-4">
        {rows.map((k) => (
          <div key={k} className="min-w-0 border-t border-rule pt-1">
            <h3 className="text-body-sm font-semibold text-ink/75">{t[`thanks.${k}`]}</h3>
            <ol className="text-body-sm">
              {view.thanks[k].map((x) => (
                <li key={x.uid} className="flex justify-between gap-2">
                  <span translate="no" className="min-w-0 truncate font-semibold">
                    {x.name}
                  </span>
                  <span className="tabular-nums">{f.compact(x.value)}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      {progress.length > 0 && (
        <div className="mt-2 border-t border-rule pt-1">
          <h3 className="text-body-sm font-semibold text-ink/75">{t["thanks.progress"]}</h3>
          <ul className="text-body-sm">
            {progress.map((p) => (
              <li key={p.uid}>
                <bdi translate="no" className="font-semibold">
                  {p.name}
                </bdi>{" "}
                {progressText(p, t)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Legend({ t }: { t: WorkspaceDictionary }) {
  return (
    <details className="mt-3 text-body-sm text-ink/80">
      <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-2 py-2">
        <span>{t["members.legend"]}</span>
        <span className="font-semibold text-plum underline underline-offset-4">
          {t["members.more"]}
        </span>
      </summary>
      <div className="space-y-1 pb-2">
        <p>{t["members.checkinHelp"]}</p>
        <p>{t["list.askHelp"]}</p>
        <p>{t["members.nodataHelp"]}</p>
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
  },
) {
  const { now, zone, showFormer } = p;
  const access = await requireWorkspace(db, p.slug, p.jar, now, RENEW_MS);
  if (!access.ok) return { access, waiting: 0, view: null, rows: [], lifecycle: null };
  // D106: a roster read since a new member was added may now list them.
  const pending = await matchOnRead(db, access, now);
  const view = await membersView(db, access, now, zone, await progressHistory(db, access));
  return {
    access,
    waiting: await toReviewCount(db, access, now),
    view,
    // The list's own read (photos and past names); the card route never runs it (issue 337).
    rows: showFormer ? [] : await withListExtras(db, access, view.members),
    lifecycle: showFormer
      ? { former: await formerMembers(db, access, zone, view.facts), pending: [], dismissed: [] }
      : {
          former: [],
          pending,
          dismissed: await dismissedMembers(db, access),
        },
  };
}

/** The editor's words; the add sheet says when the nightly roster is read (D106). */
const lifecycleEditorWords = (t: WorkspaceDictionary, readAt: string) => ({
  ...editorWords(t),
  "pending.addHelp": fill(t["pending.addHelp"], { time: readAt }),
});

/** Members · Former members (D107): two links, the open one pressed. */
function ViewSwitch({
  slug,
  former,
  t,
}: {
  slug: string;
  former: boolean;
  t: WorkspaceDictionary;
}) {
  const link = (on: boolean, href: string, label: string) => (
    <a href={href} aria-current={on ? "page" : undefined} className={`${chip(on)} justify-center`}>
      {label}
    </a>
  );
  return (
    <nav aria-label={t["members.view.aria"]} className="mt-2 flex gap-2">
      {link(!former, `/w/${slug}/members`, t["members.view.current"])}
      {link(former, `/w/${slug}/members?view=former`, t["members.view.former"])}
    </nav>
  );
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
  const search = new URLSearchParams(
    Object.entries(await searchParams).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  );
  const showFormer = search.get("view") === "former";
  // INVARIANT workspace.access-first: nothing private is read before this check.
  const { access, view, rows, waiting, lifecycle } = await withPageDb((db) =>
    readPage(db, { slug, jar, now, zone: env.SERVER_TZ, showFormer }),
  );
  if (!access.ok) {
    refuse(slug, access.reason, `/w/${slug}/members`);
    redirect(`/w/${slug}`);
  }
  if (!view || !lifecycle) notFound();
  const { language, t } = await workspaceWords();
  const f = cardFormats(language, env.SERVER_TZ, now);
  const editor = {
    slug,
    words: lifecycleEditorWords(t, env.DAILY_ROSTER_AT),
    language,
    serverZone: env.SERVER_TZ,
    used: view.zones,
  };
  return (
    <SignedInFrame access={access} language={language} t={t} current="members" waiting={waiting}>
      <h1 className="font-display text-display-lg">{t["tab.members"]}</h1>
      <TabSend {...{ slug, t, language }} tab="members" />
      <ViewSwitch slug={slug} former={showFormer} t={t} />
      {/* The page's one main action (D109): new values for several members at once. */}
      {!showFormer && view.readAt !== null && <PasteUpdates slug={slug} words={updatesWords(t)} />}
      {showFormer ? (
        <FormerMembers
          rows={lifecycle.former.map((m) => formerRow(m, t, f))}
          words={lifecycleWords(t)}
          editor={editor}
        />
      ) : view.readAt === null ? (
        <p className="mt-4 border border-rule px-4 py-5">{t["members.none"]}</p>
      ) : (
        <Roster
          {...{ slug, view, rows, t, language, search, now }}
          readAt={view.readAt}
          zone={env.SERVER_TZ}
          readHour={env.DAILY_ROSTER_AT}
          pending={
            <PendingMembers
              rows={lifecycle.pending.map((p) =>
                pendingRow(p, view.facts.get(p.uid) ?? {}, view.readAt, t, f),
              )}
              toMatchLine={toMatchLine(toMatch(lifecycle.pending, view.readAt).length, t, f)}
              dismissed={lifecycle.dismissed.map((p) =>
                dismissedRow(p, view.facts.get(p.uid) ?? {}, t, f),
              )}
              roster={view.members.map((m) => ({ uid: m.uid, name: m.name }))}
              words={lifecycleWords(t)}
              editor={editor}
            />
          }
        />
      )}
      <p className="mt-6">
        <a
          href={`/w/${slug}/import`}
          className="inline-flex min-h-11 items-center text-body-sm font-semibold text-plum underline underline-offset-4"
        >
          {t["members.import"]}
        </a>
      </p>
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
  /** New members waiting for the roster, and "Add a new member" (D106). */
  pending: ReactNode;
}) {
  const { slug, view, t, language, now, zone } = props;
  const f = cardFormats(language, zone, now);
  const today = serverDay(now, { SERVER_TZ: zone });
  const checkins = view.members.filter((m) => needsAWord(whoOf(m))).length;
  const [from, to] = [view.week[0] ?? "", view.week[6] ?? ""];
  return (
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
      <Thanks view={view} t={t} f={f} />
      {/* Before the first end-of-day read nothing is computed, so nothing is said about check-ins. */}
      <p className={view.early ? "hidden" : "mt-3"}>
        {checkins === 0 ? (
          t["members.checkinNone"]
        ) : (
          <a
            href={`/w/${slug}/members?order=rank#ml-heading`}
            className="inline-flex min-h-11 items-center py-2 font-semibold text-plum underline underline-offset-4"
          >
            {fill(plural(t, "members.checkinCount", checkins, f), { n: checkins })}
          </a>
        )}
      </p>
      <Legend t={t} />
      {props.pending}
      <MembersList
        rows={props.rows.map((m) => listRow(m, t, f))}
        early={view.early}
        words={listWords(t)}
        language={language}
        editor={{ slug, words: editorWords(t), language, serverZone: zone, used: view.zones }}
        initialQuery={pickQuery(props.search, LANGUAGES)}
        initialOrder={pickOrder(props.search.get("order"))}
        today={today}
        hour={Number(clockIn(now.getTime(), zone, today).time.slice(0, 2))}
        serverZone={zone}
        sheetHeader={sheetHeader(view.week, t)}
      />
    </>
  );
}
