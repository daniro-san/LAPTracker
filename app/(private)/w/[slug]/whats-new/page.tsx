// /w/[slug]/whats-new (issue 782): what changed on the desk, newest first, only the notes whose features this
// workspace has on. Opening it marks the newest release seen for this officer, so Home's line goes away.
// Officers only: a member's session goes to the board (refuse.ts).
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { dateWords } from "@/lib/date-words";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { requireWorkspace } from "@/lib/private/access";
import { toReviewCount } from "@/lib/private/import-view";
import { RENEW_MS } from "@/lib/private/session";
import { SLUG } from "@/lib/private/sign-in";
import { openWhatsNew } from "@/lib/private/whats-new";

import { SignedInFrame, workspaceWords } from "../../../_ui/Frame";
import { refuse } from "../../../_ui/refuse";

const LINK =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";

export default async function WhatsNewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const jar = await cookies();
  const now = new Date();
  const { language, t } = await workspaceWords(slug);
  // INVARIANT workspace.access-first: nothing private is read before this check.
  const { access, items, waiting } = await withPageDb(async (db) => {
    const access = await requireWorkspace(db, slug, jar, now, RENEW_MS);
    if (!access.ok) return { access, items: [], waiting: 0 };
    const [items, waiting] = await Promise.all([
      openWhatsNew(db, access, language),
      toReviewCount(db, access, now),
    ]);
    return { access, items, waiting };
  });
  if (!access.ok) {
    refuse(slug, access.reason, `/w/${slug}/whats-new`);
    redirect(`/w/${slug}`);
  }
  const words = dateWords(language, getEnv().SERVER_TZ);
  return (
    <SignedInFrame access={access} language={language} t={t} current={null} waiting={waiting}>
      <a href={`/w/${slug}`} className={LINK}>
        {t["whatsnew.back"]}
      </a>
      <h1 className="font-display text-display-lg">{t["whatsnew.title"]}</h1>
      <p className="mt-1 max-w-2xl">{t["whatsnew.lead"]}</p>
      {items.length === 0 ? (
        <p className="mt-4">{t["whatsnew.none"]}</p>
      ) : (
        <ul className="mt-4 max-w-2xl space-y-4">
          {items.map((item) => (
            <li key={`${item.version}-${item.title}`} className="drawn-card px-4 py-3">
              <h2 className="font-subhead text-display-sm">{item.title}</h2>
              <p className="text-body-sm text-ink/75">{words.withYear(item.date)}</p>
              <p className="mt-1">{item.text}</p>
            </li>
          ))}
        </ul>
      )}
    </SignedInFrame>
  );
}
