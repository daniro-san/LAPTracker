// /w/[slug]/notices/new (issue 304): write a notice. The officer writes in any of the three languages and
// can fill the others with Translate before saving; the first save makes the notice.
import { getAppContext } from "@/lib/app-context";
import { NOTICE_FIELDS } from "@/lib/private/notice-rules";

import { SignedInFrame, workspaceWords } from "../../../../_ui/Frame";
import type { NoticeFields } from "../../../../_ui/notice-client";
import { languagesFor, noticePage } from "../../../../_ui/notice-pages";
import { NoticeEditor } from "../../../../_ui/NoticeEditor";

const EMPTY = Object.fromEntries(
  NOTICE_FIELDS.map((f) => [f, { value: "", version: 0 }]),
) as NoticeFields;

export default async function NewNoticePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { access, waiting } = await noticePage(slug, async () => true, "/new");
  const { language, t } = await workspaceWords();
  return (
    <SignedInFrame access={access} language={language} t={t} current="days" waiting={waiting}>
      <p>
        <a
          href={`/w/${slug}/notices`}
          className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          ← {t["notices.back"]}
        </a>
      </p>
      <h1 className="font-display text-display-lg">{t["notices.new"]}</h1>
      <NoticeEditor
        slug={slug}
        id={null}
        fields={EMPTY}
        stale={[]}
        t={t}
        viewer={language}
        ai={getAppContext().ai !== null}
        languages={languagesFor(language)}
        source={null}
      />
    </SignedInFrame>
  );
}
