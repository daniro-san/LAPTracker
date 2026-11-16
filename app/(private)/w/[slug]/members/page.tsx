// /w/[slug]/members (issue 296): the alliance's members from its newest end-of-day read (D72), thanks
// first, then one card per member with the week's donations and what we saw (D75). The access check runs
// before anything is read (D71); a refused visitor goes to the workspace's sign-in.
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { compact, exact } from "@/app/_ui/format";
import { fill } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { requireWorkspace, type Refusal } from "@/lib/private/access";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { membersView, type MemberRow, type MembersView } from "@/lib/private/members";
import { sheetHeader, sheetRow } from "@/lib/private/members-sheet";
import { SLUG } from "@/lib/private/sign-in";

import { SignedInFrame, workspaceWords } from "../../../_ui/Frame";
import { MemberCard, type CardFormats } from "../../../_ui/MemberCard";
import { MembersList, type MemberFilter } from "../../../_ui/MembersList";

/** Server days as dates in the officer's language; instants in server time (help.servertime). */
function formats(
  language: WorkspaceLanguage,
  zone: string,
): CardFormats & { time: (at: Date) => string } {
  const options = { weekday: "short", day: "numeric", month: "short" } as const;
  const day = new Intl.DateTimeFormat(language, { ...options, timeZone: "UTC" });
  const instant = new Intl.DateTimeFormat(language, { ...options, timeZone: zone });
  const hhmm = new Intl.DateTimeFormat(language, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: zone,
  });
  return {
    date: (at) =>
      typeof at === "string" ? day.format(new Date(`${at}T00:00:00Z`)) : instant.format(at),
    number: (n) => exact(n, language),
    compact: (n) => compact(n, language),
    time: (at) => `${instant.format(at)} ${hhmm.format(at)}`,
  };
}

const filtersOf = (m: MemberRow): MemberFilter[] => [
  ...(m.isNew ? (["new"] as const) : []),
  ...(m.reasons.length > 0 ? (["checkin"] as const) : []),
  ...(m.missing.length > 0 ? (["missing"] as const) : []),
  ...((m.rankCode ?? 0) >= 104 ? (["r4"] as const) : []),
];

function Thanks({ view, t, f }: { view: MembersView; t: WorkspaceDictionary; f: CardFormats }) {
  const rows = (["donors", "activity"] as const).filter((k) => view.thanks[k].length > 0);
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="thanks" className="mt-4 border border-rule px-4 py-4">
      <h2 id="thanks" className="font-subhead text-display-sm">
        {t["thanks.head"]}
      </h2>
      <p className="mt-1">{t["thanks.intro"]}</p>
      <dl className="mt-3">
        {rows.map((k) => (
          <div key={k} className="border-t border-rule py-2">
            <dt className="text-body-sm font-semibold text-ink/75">{t[`thanks.${k}`]}</dt>
            <dd className="mt-1">
              {view.thanks[k].map((x, i) => (
                <span key={x.uid}>
                  {i > 0 && " · "}
                  <span translate="no" className="font-semibold">
                    {x.name}
                  </span>{" "}
                  <span className="tabular-nums">{f.compact(x.value)}</span>
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Where a refused visitor goes: no workspace is a 404; otherwise Discord again, or the sign-in. */
function refuse(slug: string, reason: Refusal["reason"]): never {
  if (reason === "no_workspace") notFound();
  if (reason === "expired") redirect(`/api/w/${slug}/login?silent=1`);
  if (reason === "blocked") redirect(`/w/${slug}/no-access?why=blocked`);
  redirect(`/w/${slug}`);
}

export default async function MembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const jar = await cookies();
  const now = new Date();
  // INVARIANT workspace.access-first: nothing private is read before this check.
  const { access, view } = await withPageDb(async (db) => {
    const access = await requireWorkspace(db, slug, jar, now);
    return { access, view: access.ok ? await membersView(db, access, now) : null };
  });
  if (!access.ok) refuse(slug, access.reason);
  if (!view) notFound();
  const { language, t } = await workspaceWords();
  const f = formats(language, getEnv().SERVER_TZ);
  const [from, to] = [view.week[0], view.week[6]];
  return (
    <SignedInFrame access={access} language={language} t={t} current="members">
      <h1 className="font-display text-display-lg">{t["tab.members"]}</h1>
      {view.readAt === null || !from || !to ? (
        <p className="mt-4 border border-rule px-4 py-5">{t["members.none"]}</p>
      ) : (
        <>
          <p className="mt-2 text-body-sm text-ink/80">
            {fill(t["members.lead"], {
              when: fill(t["time.server"], { time: f.time(view.readAt) }),
            })}
          </p>
          <p className="mt-1 text-body-sm text-ink/80">
            {fill(t["members.week"], { from: f.date(from), to: f.date(to) })}
          </p>
          <Thanks view={view} t={t} f={f} />
          <div className="mt-4 space-y-1 text-body-sm text-ink/80">
            <p>{t["members.checkinHelp"]}</p>
            <p>{t["members.nodataHelp"]}</p>
          </div>
          <MembersList
            t={t}
            header={sheetHeader(view.week, t)}
            items={view.members.map((m) => ({
              name: m.name,
              filters: filtersOf(m),
              line: sheetRow(m, t, f),
            }))}
          >
            {view.members.map((m) => (
              <MemberCard key={m.uid} m={m} week={view.week} t={t} f={f} />
            ))}
          </MembersList>
        </>
      )}
    </SignedInFrame>
  );
}
