// /w/[slug]/board/me (issue 487, D142): a member's own page on the members' board. The board's door first
// (requireBoard), then the link: with none, the member picks their player ("This is me", D87); while an
// officer has to confirm it, a waiting line and nothing private; once approved, only their own data (the
// MeAccess carries the link's uid, never the request's). A member no longer in the newest roster sees why
// the page is closed. An officer sees their own page the same way.
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { MarginNote } from "@/lib/brand/components/layout/MarginNote";
import { PageHead } from "@/lib/brand/components/layout/PageHead";
import { Spread } from "@/lib/brand/components/layout/Spread";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { meAccess, requireBoard, type CookieReader } from "@/lib/private/access";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { selfReportWords } from "@/lib/private/dictionary.self-report";
import { featureOn } from "@/lib/private/features";
import { meView, type MeView } from "@/lib/private/me";
import { linkedName, linkPicker, type LinkPicker } from "@/lib/private/me-link";
import { cardFormats } from "@/lib/private/member-card";
import { ownReport, REPORT_FIELDS, type OwnReports } from "@/lib/private/self-report";
import { SLUG } from "@/lib/private/sign-in";
import { fill } from "@/lib/words";

import { BoardAccount } from "../../../../_ui/BoardAccount";
import { LINK } from "../../../../_ui/BoardSections";
import { editorWords } from "../../../../_ui/facts-form";
import { Feedback } from "../../../../_ui/Feedback";
import { Frame, workspaceWords } from "../../../../_ui/Frame";
import { MeLink } from "../../../../_ui/MeLink";
import { MeNeeded, MeProgress, MeSquads, MeWeek } from "../../../../_ui/MeSections";
import { MeSelfReport } from "../../../../_ui/MeSelfReport";
import { refuse } from "../../../../_ui/refuse";

export const metadata: Metadata = { title: "Your page" };

type Shown =
  | { kind: "pick"; picker: LinkPicker }
  | { kind: "pending"; name: string | null }
  | { kind: "me"; view: MeView; reports: OwnReports };

/** INVARIANT workspace.access-first: nothing private is read before the access check. */
function readMe(
  slug: string,
  jar: CookieReader,
  at: {
    now: Date;
    zone: string;
    endRead: string;
    language: WorkspaceLanguage;
    t: WorkspaceDictionary;
  },
) {
  return withPageDb(async (db) => {
    const board = await requireBoard(db, slug, jar, at.now);
    if (!board.ok || !featureOn(board, "board")) return { board, shown: null };
    const me = meAccess(board);
    const shown: Shown = me
      ? {
          kind: "me",
          ...(await Promise.all([meView(db, me, at), ownReport(db, board, me)]).then(
            ([view, reports]) => ({ view, reports }),
          )),
        }
      : board.player
        ? { kind: "pending", name: await linkedName(db, board) }
        : { kind: "pick", picker: await linkPicker(db, board) };
    return { board, shown };
  });
}

function Body(props: {
  shown: Shown;
  slug: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  /** When the server rendered the page (epoch ms). */
  now: number;
}) {
  const { shown, slug, t, language } = props;
  const link = { slug, t, language };
  if (shown.kind === "pick")
    return (
      <section aria-labelledby="me-link" className="drawn-card mt-4 max-w-(--form-max) px-4 py-4">
        <h2 id="me-link" className="font-subhead text-display-sm">
          {t["me.link.head"]}
        </h2>
        <p className="mt-1 text-body-sm">{t["me.link.lead"]}</p>
        {shown.picker.roster.length === 0 ? (
          <p className="mt-2">{t["me.link.noRoster"]}</p>
        ) : (
          <MeLink {...link} state={{ kind: "pick", picker: shown.picker }} />
        )}
      </section>
    );
  if (shown.kind === "pending")
    return (
      <section className="drawn-card mt-4 max-w-(--form-max) px-4 py-4">
        <p role="status">{fill(t["me.pending"], { name: shown.name ?? "—" })}</p>
        <MeLink {...link} state={{ kind: "pending" }} />
      </section>
    );
  const { view } = shown;
  if (view.left)
    return (
      <section className="drawn-card mt-4 max-w-(--form-max) px-4 py-4">
        <p>{fill(t["me.left"], { name: view.name })}</p>
        <MeLink {...link} state={{ kind: "linked" }} />
      </section>
    );
  const zone = getEnv().SERVER_TZ;
  const f = cardFormats(language, zone, new Date());
  const { reports } = shown;
  const days = Object.fromEntries(
    REPORT_FIELDS.map((field) => {
      const at = reports[field]?.at;
      return [field, at ? f.date(new Date(at)) : null];
    }),
  ) as Record<(typeof REPORT_FIELDS)[number], string | null>;
  return (
    <Spread
      marginFirst
      main={
        <>
          {/* D154: first in the main column, so a member finds it without scrolling past the charts. */}
          <MeSelfReport
            slug={slug}
            language={language}
            serverZone={zone}
            reports={reports}
            words={selfReportWords(t)}
            editor={editorWords(t)}
            days={days}
          />
          <MeProgress view={view} t={t} language={language} f={f} />
          <MeWeek view={view} t={t} />
          <MeSquads view={view} />
        </>
      }
      margin={
        <MarginNote id="me-needed" title={t["me.needed.head"]}>
          <p className="py-1 text-body-sm text-ink/75">{t["me.needed.lead"]}</p>
          <MeNeeded view={view} t={t} since={props.now} />
          <div className="py-2">
            <p className="text-body-sm">{fill(t["me.linked"], { name: view.name })}</p>
            <MeLink {...link} state={{ kind: "linked" }} />
          </div>
        </MarginNote>
      }
    />
  );
}

export default async function MePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const jar = await cookies();
  const now = new Date();
  const { language, t } = await workspaceWords();
  const env = getEnv();
  const at = { now, zone: env.SERVER_TZ, endRead: env.SNAPSHOT_AFTER, language, t };
  const { board, shown } = await readMe(slug, jar, at);
  if (!board.ok) {
    refuse(slug, board.reason, `/w/${slug}/board/me`);
    redirect(`/w/${slug}`);
  }
  // D126: with the board turned off there is no page of a member's own either.
  if (!shown) {
    if (board.officer) redirect(`/w/${slug}`);
    notFound();
  }
  const { alliance } = board;
  return (
    <Frame
      language={language}
      t={t}
      title={t["board.name"]}
      account={<BoardAccount officer={board.officer} name={board.name ?? ""} slug={slug} t={t} />}
      {...(alliance && { subtitle: `${alliance.tag} · ${alliance.name}` })}
      wide
    >
      <p>
        <a href={`/w/${slug}/board`} className={LINK}>
          ← {t["me.back"]}
        </a>
      </p>
      <PageHead id="me-title" title={t["me.title"]} meta={t["me.lead"]} />
      {board.officer && <p className="mb-2 text-body-sm text-ink/75">{t["me.preview"]}</p>}
      <Body shown={shown} slug={slug} t={t} language={language} now={now.getTime()} />
      <Feedback slug={slug} area="board" language={language} t={t} />
    </Frame>
  );
}
