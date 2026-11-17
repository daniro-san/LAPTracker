// /w/[slug]/notices/[id] (issue 304): one notice, read in each language with a Copy per language, and its
// editor. A notice of another workspace is a 404, like one that does not exist (D71).
import { notFound } from "next/navigation";

import { getAppContext } from "@/lib/app-context";
import { noticeDetail } from "@/lib/private/notices";

import { SignedInFrame, workspaceWords } from "../../../../_ui/Frame";
import { languagesFor, noticePage, noticeWords, sourceFor } from "../../../../_ui/notice-pages";
import { NoticeScreen } from "../../../../_ui/NoticeScreen";

export default async function NoticePage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id: raw } = await params;
  const id = /^[1-9]\d{0,8}$/.test(raw) ? Number(raw) : null;
  if (id === null) notFound();
  const {
    access,
    data: notice,
    waiting,
  } = await noticePage(slug, (db, a) => noticeDetail(db, a, id), `/${id}`);
  if (!notice) notFound();
  const { language, t } = await workspaceWords();
  const words = noticeWords(language, t);
  const languages = languagesFor(language);
  // A new version of any field remounts the screen, so a save or a refresh closes the editor.
  const key = Object.values(notice.fields)
    .map((f) => f.version)
    .join(".");
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
      <NoticeScreen
        key={key}
        slug={slug}
        id={notice.id}
        fields={notice.fields}
        stale={notice.stale}
        t={t}
        viewer={language}
        ai={getAppContext().ai !== null}
        languages={languages}
        source={sourceFor(languages, notice.fields, notice.stale)}
        meta={{
          written: words.written(notice.createdBy, notice.createdAt),
          changed: words.changed(notice.updatedBy, notice.updatedAt),
          flags: words.flags(notice),
        }}
      />
    </SignedInFrame>
  );
}
