// /w/[slug]/start-here: the officers edit the members' board's Start here (D105), one record in EN, PT and
// FR. Officers only: a member's session goes to the board (refuse.ts).
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getAppContext } from "@/lib/app-context";
import { fill, isolate } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import { requireWorkspace } from "@/lib/private/access";
import { agoText } from "@/lib/private/calendar-words";
import { toReviewCount } from "@/lib/private/import-view";
import { DRAFT_LIMIT, NOTICE_LANGUAGES } from "@/lib/private/notice-rules";
import { RENEW_MS } from "@/lib/private/session";
import { SLUG } from "@/lib/private/sign-in";
import { START_HERE_MAX, startHereEdit } from "@/lib/private/start-here";

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
    const [edit, waiting] = await Promise.all([
      startHereEdit(db, access),
      toReviewCount(db, access, now),
    ]);
    return { access, edit, waiting };
  });
  if (!access.ok || !edit) {
    if (!access.ok) refuse(slug, access.reason, `/w/${slug}/start-here`);
    redirect(`/w/${slug}`);
  }
  const { language, t } = await workspaceWords();
  const link =
    "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";
  return (
    <SignedInFrame access={access} language={language} t={t} current="days" waiting={waiting}>
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
        translate={{
          button: t["notices.translate"],
          to: t["notices.translate.to"],
          working: t["notices.working"],
          draft: t["notices.draft.translate"],
          accept: t["notices.accept"],
          undo: t["notices.undo"],
          partly: t["notices.draft.partly"],
          off: t["notices.ai.off"],
          tooLong: fill(t["notices.ai.tooLong"], { limit: DRAFT_LIMIT }),
          timeout: t["notices.ai.timeout"],
          busy: t["notices.ai.busy"],
          failed: t["notices.ai.failed"],
        }}
        words={{
          glossary: t["board.start.glossary"],
          rules: t["board.start.rules"],
          ask: t["board.start.ask"],
          glossaryHelp: t["starthere.glossary.help"],
          rulesHelp: t["starthere.rules.help"],
          askHelp: t["starthere.ask.help"],
          languages: t["notices.languages"],
          save: t["starthere.save"],
          saving: t["starthere.saving"],
          saved: t["starthere.saved"],
          failed: t["starthere.failed"],
          conflict: t["starthere.conflict"],
          missing: t["starthere.missing"],
          someone: t["starthere.someone"],
        }}
      />
    </SignedInFrame>
  );
}
