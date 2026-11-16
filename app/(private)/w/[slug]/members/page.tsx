// /w/[slug]/members (issue 296): the alliance's members from its newest end-of-day read (D72), thanks
// first, then one card per member with the week's donations and what we saw (D75). The access check runs
// before anything is read (D71). The filter (?f=) and the name search (?q=) are applied on the server, so
// they work as plain links and a GET form, and each card is sent once.
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { compact, exact } from "@/app/_ui/format";
import { fill } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { requireWorkspace } from "@/lib/private/access";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { membersView, type MembersView } from "@/lib/private/members";
import {
  filterCounts,
  keepMembers,
  MEMBER_FILTERS,
  pickFilter,
  type MemberFilter,
} from "@/lib/private/members-list";
import { plural, sheetHeader, sheetRow } from "@/lib/private/members-sheet";
import { SLUG } from "@/lib/private/sign-in";

import { CopyButton } from "../../../_ui/CopyButton";
import { SignedInFrame, workspaceWords } from "../../../_ui/Frame";
import { cardData, type CardFormats } from "../../../_ui/member-card-data";
import { MemberCards } from "../../../_ui/MemberCards";
import { refuse } from "../../../_ui/refuse";
import { SourceBadge } from "../../../_ui/SourceBadge";

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
    language,
    zone,
  };
}

/** The address of the list with this filter and search. */
function listHref(slug: string, f: MemberFilter, q: string) {
  const query = new URLSearchParams({ ...(f !== "all" && { f }), ...(q && { q }) }).toString();
  return `/w/${slug}/members${query ? `?${query}` : ""}`;
}

function Thanks({ view, t, f }: { view: MembersView; t: WorkspaceDictionary; f: CardFormats }) {
  const rows = (["donors", "activity"] as const).filter((k) => view.thanks[k].length > 0);
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="thanks" className="mt-4 border border-rule px-4 py-4">
      <h2 id="thanks" className="font-subhead text-display-sm">
        {t["thanks.head"]}
      </h2>
      <p className="mt-1">{t["thanks.intro"]}</p>
      {rows.map((k) => (
        <div key={k} className="mt-3 border-t border-rule pt-2">
          <h3 className="text-body-sm font-semibold text-ink/75">{t[`thanks.${k}`]}</h3>
          <ol className="mt-1">
            {view.thanks[k].map((x) => (
              <li key={x.uid} className="flex justify-between gap-3">
                <span translate="no" className="min-w-0 truncate font-semibold">
                  {x.name}
                </span>
                <span className="tabular-nums">{f.compact(x.value)}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
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
        <p>{t["members.nodataHelp"]}</p>
        <p>{t["members.weekHelp"]}</p>
      </div>
    </details>
  );
}

function Controls(props: {
  slug: string;
  t: WorkspaceDictionary;
  filter: MemberFilter;
  query: string;
  counts: Record<MemberFilter, number>;
}) {
  const { slug, t, filter, query, counts } = props;
  return (
    <>
      <form method="get" role="search" className="mt-4 flex gap-2">
        {filter !== "all" && <input type="hidden" name="f" value={filter} />}
        <input
          type="search"
          name="q"
          defaultValue={query}
          maxLength={64}
          placeholder={t["members.search.ph"]}
          aria-label={t["members.search.aria"]}
          className="min-h-11 min-w-0 flex-1 border border-rule bg-paper px-3"
        />
        <button type="submit" className="min-h-11 border border-rule px-4 font-medium">
          {t["members.search.go"]}
        </button>
      </form>
      <nav aria-label={t["members.filter.aria"]} className="mt-3">
        <ul className="flex flex-wrap gap-2">
          {MEMBER_FILTERS.map((id) => (
            <li key={id}>
              <a
                href={listHref(slug, id, query)}
                aria-current={id === filter ? "true" : undefined}
                className={`inline-flex min-h-11 items-center gap-1.5 border px-3 text-body-sm font-medium whitespace-nowrap ${
                  id === filter ? "border-plum bg-plum text-paper" : "border-rule"
                }`}
              >
                {t[`members.filter.${id}`]}
                <span className="tabular-nums">{counts[id]}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
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
  // INVARIANT workspace.access-first: nothing private is read before this check.
  const { access, view } = await withPageDb(async (db) => {
    const access = await requireWorkspace(db, slug, jar, now);
    return { access, view: access.ok ? await membersView(db, access, now) : null };
  });
  if (!access.ok) {
    refuse(slug, access.reason);
    redirect(`/w/${slug}`);
  }
  if (!view) notFound();
  const search = await searchParams;
  const filter = pickFilter(search.f);
  const query = (typeof search.q === "string" ? search.q : "").trim().slice(0, 64);
  const { language, t } = await workspaceWords();
  const f = formats(language, getEnv().SERVER_TZ);
  return (
    <SignedInFrame access={access} language={language} t={t} current="members">
      <h1 className="font-display text-display-lg">{t["tab.members"]}</h1>
      {view.readAt === null ? (
        <p className="mt-4 border border-rule px-4 py-5">{t["members.none"]}</p>
      ) : (
        <Body
          slug={slug}
          view={view}
          t={t}
          f={f}
          filter={filter}
          query={query}
          readAt={f.time(view.readAt)}
        />
      )}
    </SignedInFrame>
  );
}

function Body(props: {
  slug: string;
  view: MembersView;
  t: WorkspaceDictionary;
  f: CardFormats;
  filter: MemberFilter;
  query: string;
  readAt: string;
}) {
  const { slug, view, t, f, filter, query } = props;
  const shown = {
    joined: view.members.some((m) => m.joinedAt !== null),
    lastOnline: view.members.some((m) => m.lastOnlineAt !== null),
  };
  const counts = filterCounts(view.members);
  const visible = keepMembers(view.members, filter, query);
  const [from, to] = [view.week[0] ?? "", view.week[6] ?? ""];
  return (
    <>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 text-body-sm text-ink/80">
        <span>{t["members.lead"]}</span>
        <SourceBadge source="game" label={t["src.game"]} />
      </p>
      <p className="mt-1 text-body-sm text-ink/80">
        {fill(t["members.lastRead"], { when: fill(t["time.server"], { time: props.readAt }) })}
      </p>
      <p className="mt-1 text-body-sm text-ink/80">
        {fill(t["members.week"], { from: f.date(from), to: f.date(to) })}
      </p>
      <Thanks view={view} t={t} f={f} />
      <p className="mt-3">
        {counts.checkin === 0 ? (
          t["members.checkinNone"]
        ) : (
          <a
            href={listHref(slug, "checkin", "")}
            className="inline-flex min-h-11 items-center py-2 font-semibold text-plum underline underline-offset-4"
          >
            {fill(plural(t, "members.checkinCount", counts.checkin, f), { n: counts.checkin })}
          </a>
        )}
      </p>
      <Legend t={t} />
      <Controls slug={slug} t={t} filter={filter} query={query} counts={counts} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-body-sm tabular-nums">
          {fill(t["members.count"], { n: visible.length, total: view.members.length })}
        </p>
        <CopyButton
          text={[sheetHeader(view.week, t), ...visible.map((m) => sheetRow(m, t, f))].join("\n")}
          labels={{
            copy: t["members.copy"],
            copied: t["members.copied"],
            failed: t["members.copyFailed"],
          }}
        />
      </div>
      {visible.length === 0 ? (
        <p className="mt-4">{t["members.empty"]}</p>
      ) : (
        <MemberCards
          cards={visible.map((m) => cardData(m, view.week, t, f, shown))}
          details={{ open: t["members.details"], of: t["members.detailsOf"] }}
        />
      )}
    </>
  );
}
