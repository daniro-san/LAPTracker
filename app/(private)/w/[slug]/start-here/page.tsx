// /w/[slug]/start-here: the officers edit the members' board's Start here (D105), one record in EN, PT and
// FR. Officers only: a member's session goes to the board (refuse.ts).
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getAppContext } from "@/lib/app-context";
import { isolate } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import { requireWorkspace } from "@/lib/private/access";
import { agoText } from "@/lib/private/calendar-words";
import { featureOn, writingOff } from "@/lib/private/features";
import { toReviewCount } from "@/lib/private/import-view";
import { NOTICE_LANGUAGES } from "@/lib/private/notice-rules";
import { RENEW_MS } from "@/lib/private/session";
import { SLUG } from "@/lib/private/sign-in";
import { START_HERE_MAX, startHereEdit } from "@/lib/private/start-here";
import { fill } from "@/lib/words";

import { SignedInFrame, workspaceWords } from "../../../_ui/Frame";
import { refuse } from "../../../_ui/refuse";
import { StartHereEditor } from "../../../_ui/StartHereEditor";

export default async function StartHerePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const jar = await cookies();
  const now = new Date();
  // INVARIANT workspace.access-first: nothing private is read before this check.
  const { access, edit, waiting } = await withPageDb(async (db) => {
    const access = await requireWorkspace(db, slug, jar, now, RENEW_MS);
    if (!access.ok) return { access, edit: null, waiting: 0 };
    // D126: Start here belongs to the members' board; with the board off it reads nothing.
    const [edit, waiting] = await Promise.all([
      featureOn(access, "board") ? startHereEdit(db, access) : null,
      toReviewCount(db, access, now),
    ]);
    return { access, edit, waiting };
  });
  if (!access.ok) {
    refuse(slug, access.reason, `/w/${slug}/start-here`);
    redirect(`/w/${slug}`);
  }
  // D126: with the board off, Start here is not there either: its address goes to Home.
  if (!edit) redirect(`/w/${slug}`);
  const { language, t } = await workspaceWords(slug);
  const link =
    "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";
  return (
    <SignedInFrame access={access} language={language} t={t} current={null} waiting={waiting}>
      <a href={`/w/${slug}/board`} className={link}>
        {t["starthere.board"]}
      </a>
      <h1 className="font-display text-display-lg">{t["starthere.title"]}</h1>
      <p className="mt-1 max-w-2xl">{t["starthere.lead"]}</p>
      {edit.saved && (
        <p className="mt-1 text-body-sm text-ink/75">
          {fill(t["starthere.lastSaved"], {
            name: isolate(edit.saved.by ?? t["starthere.someone"]),
            when: agoText(edit.saved.at, now, language, t["calendar.conflict.justNow"]),
          })}
        </p>
      )}
      <StartHereEditor
        slug={slug}
        languages={NOTICE_LANGUAGES}
        first={language}
        texts={edit.texts}
        versions={edit.versions}
        max={START_HERE_MAX}
        ai={getAppContext().ai !== null}
        aiOff={writingOff(access)}
        t={t}
        viewer={language}
      />
    </SignedInFrame>
  );
}
