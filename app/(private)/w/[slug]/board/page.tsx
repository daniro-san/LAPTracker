// /w/[slug]/board, the members' board (D105, issue 331): read-only, for a member's session and for an officer
// looking at what members see. The access check first (requireBoard: never a WorkspaceAccess), then this
// week's member-marked Calendar entries on the viewer's own clock with server time beside them, the notices
// marked for members with their end day, and Start here. Nothing about any person.
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { ALLIANCES } from "@/config/alliances";
import { fill, isolate } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { requireBoard } from "@/lib/private/access";
import { boardView } from "@/lib/private/board";
import { noticeChannels } from "@/lib/private/notice-publish";
import { SLUG } from "@/lib/private/sign-in";
import { serverDay } from "@/lib/schedule";

import { LINK, Notices, StartHere, Week } from "../../../_ui/BoardSections";
import { Frame, workspaceWords } from "../../../_ui/Frame";
import { refuse } from "../../../_ui/refuse";
import { SignOutButton } from "../../../_ui/SignOutButton";

export const metadata: Metadata = { title: "Members’ board" };

export default async function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const jar = await cookies();
  const now = new Date();
  const env = getEnv();
  const today = serverDay(now, env);
  // INVARIANT workspace.access-first: nothing private is read before this check.
  const { access, view } = await withPageDb(async (db) => {
    const access = await requireBoard(db, slug, jar, now);
    return { access, view: access.ok ? await boardView(db, access, today) : null };
  });
  if (!access.ok || !view) {
    if (!access.ok) refuse(slug, access.reason, `/w/${slug}/board`);
    redirect(`/w/${slug}`);
  }
  const { language, t } = await workspaceWords();
  const alliance = ALLIANCES.find((a) => a.unionId === access.unionId);
  const name = access.name ?? "";
  const account = (
    <>
      <span className="min-w-0 truncate">{fill(t["shell.signedIn"], { name: isolate(name) })}</span>
      <SignOutButton
        slug={slug}
        words={{ label: t["shell.signOut"], ask: t["shell.signOutAsk"], stay: t["shell.stay"] }}
      />
    </>
  );
  return (
    <Frame
      language={language}
      t={t}
      title={t["board.name"]}
      account={account}
      {...(alliance && { subtitle: `${alliance.tag} · ${alliance.name}` })}
    >
      {access.officer && (
        <aside className="mb-4 border-l-4 border-plum pl-3">
          <p>{t["board.preview"]}</p>
          <p className="flex flex-wrap gap-x-4">
            <a href={`/w/${slug}`} className={LINK}>
              {t["board.preview.back"]}
            </a>
            <a href={`/w/${slug}/start-here`} className={LINK}>
              {t["board.preview.edit"]}
            </a>
          </p>
        </aside>
      )}
      <h1 className="font-display text-display-lg">{t["board.title"]}</h1>
      <Week t={t} language={language} today={today} entries={view.entries} notices={view.notices} />
      <Notices t={t} language={language} notices={view.notices} />
      <StartHere
        t={t}
        language={language}
        texts={view.startHere}
        channel={noticeChannels(env, slug).members?.name ?? null}
        guildId={access.guildId}
      />
    </Frame>
  );
}
