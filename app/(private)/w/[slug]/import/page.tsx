// /w/[slug]/import (issue 297): the one-time import of the alliance's old spreadsheets into member facts,
// reached from the Members tab. The access check runs before anything else (D71); the page itself reads
// nothing, and the sheet goes only to POST /api/w/[slug]/import.
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { withPageDb } from "@/lib/page";
import { requireWorkspace } from "@/lib/private/access";
import { toReviewCount } from "@/lib/private/import-view";
import { RENEW_MS } from "@/lib/private/session";
import { SLUG } from "@/lib/private/sign-in";

import { importWords } from "../../../_ui/facts-form";
import { SignedInFrame, workspaceWords } from "../../../_ui/Frame";
import { refuse } from "../../../_ui/refuse";
import { SheetImport } from "../../../_ui/SheetImport";

export default async function ImportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const jar = await cookies();
  // INVARIANT workspace.access-first: nothing private is read before this check.
  const now = new Date();
  const { access, waiting } = await withPageDb(async (db) => {
    const access = await requireWorkspace(db, slug, jar, now, RENEW_MS);
    return { access, waiting: access.ok ? await toReviewCount(db, access, now) : 0 };
  });
  if (!access.ok) {
    refuse(slug, access.reason, `/w/${slug}/import`);
    redirect(`/w/${slug}`);
  }
  const { language, t } = await workspaceWords(slug);
  return (
    <SignedInFrame access={access} language={language} t={t} current="members" waiting={waiting}>
      <h1 className="font-display text-display-lg">{t["members.import"]}</h1>
      <p className="mt-2 max-w-prose">{t["import.lead"]}</p>
      <SheetImport slug={slug} words={importWords(t)} language={language} />
    </SignedInFrame>
  );
}
