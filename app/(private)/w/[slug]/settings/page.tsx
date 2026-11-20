// /w/[slug]/settings: Alliance settings (D124, issue 438). The alliance's own tracker key: its state, last 4
// characters and quota left, and Save and test, Replace and Remove. Then the alliance's data (D125): "Download
// our data" and "Delete this workspace". Officers only: a
// member's session goes to the board (refuse.ts). The key itself never reaches the page.
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { getAppContext } from "@/lib/app-context";
import { fill } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import { requireWorkspace } from "@/lib/private/access";
import { agoText } from "@/lib/private/calendar-words";
import { featureOn } from "@/lib/private/features";
import { toReviewCount } from "@/lib/private/import-view";
import { RENEW_MS } from "@/lib/private/session";
import { SLUG } from "@/lib/private/sign-in";
import { trackerKeyView } from "@/lib/private/tracker-key";
import { DELETION_GRACE_MS } from "@/lib/private/workspace-deletion";

import { deletionDate, SignedInFrame, workspaceWords } from "../../../_ui/Frame";
import { refuse } from "../../../_ui/refuse";
import { TrackerKeyForm } from "../../../_ui/TrackerKeyForm";
import { WorkspaceDataForm } from "../../../_ui/WorkspaceDataForm";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const jar = await cookies();
  const now = new Date();
  const { env } = getAppContext();
  // INVARIANT workspace.access-first: nothing private is read before this check.
  const { access, view, waiting } = await withPageDb(async (db) => {
    const access = await requireWorkspace(db, slug, jar, now, RENEW_MS);
    if (!access.ok) return { access, view: null, waiting: 0 };
    const [view, waiting] = await Promise.all([
      trackerKeyView(db, access, env, now),
      toReviewCount(db, access, now),
    ]);
    return { access, view, waiting };
  });
  if (!access.ok || !view) {
    if (!access.ok) refuse(slug, access.reason, `/w/${slug}/settings`);
    notFound();
  }
  const { language, t } = await workspaceWords();
  const checked = view.checkedAt
    ? fill(t["key.checked"], {
        when: agoText(view.checkedAt.toISOString(), now, language, t["calendar.conflict.justNow"]),
      })
    : null;
  return (
    <SignedInFrame access={access} language={language} t={t} current="home" waiting={waiting}>
      <h1 className="font-display text-display-lg">{t["settings.title"]}</h1>
      <section aria-labelledby="tracker-key" className="drawn-card mt-4 max-w-2xl px-4 py-3">
        <h2 id="tracker-key" className="font-subhead text-display-sm">
          {t["key.head"]}
        </h2>
        <p className="mt-1">{t["key.lead"]}</p>
        <TrackerKeyForm
          slug={slug}
          view={{
            state: view.state,
            last4: view.last4,
            quota:
              view.quotaRemaining === null
                ? null
                : fill(t["key.quota"], {
                    n: new Intl.NumberFormat(language).format(view.quotaRemaining),
                  }),
            checked,
          }}
          t={t}
        />
      </section>
      <WorkspaceDataForm
        slug={slug}
        t={t}
        graceDate={deletionDate(new Date(now.getTime() + DELETION_GRACE_MS), language)}
        deletionDate={access.purgeAfter ? deletionDate(access.purgeAfter, language) : null}
        download={featureOn(access, "export")}
      />
    </SignedInFrame>
  );
}
