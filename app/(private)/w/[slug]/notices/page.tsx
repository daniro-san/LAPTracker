// /w/[slug]/notices (issue 304): the leadership's notices library, the most recently changed first. One card
// per notice: its title, which languages are written and which may be out of date, whether members see it
// and until when, and who changed it last. The access check runs before anything is read (D71).
import { buttonClass } from "@/lib/brand/components/Button";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { noticesList, type NoticeSummary } from "@/lib/private/notices";

import { SignedInFrame, workspaceWords } from "../../../_ui/Frame";
import { LANGUAGE_CODE } from "../../../_ui/notice-client";
import { noticePage, noticeWords } from "../../../_ui/notice-pages";

function Card({
  slug,
  notice,
  t,
  words,
}: {
  slug: string;
  notice: NoticeSummary;
  t: WorkspaceDictionary;
  words: ReturnType<typeof noticeWords>;
}) {
  return (
    <a
      href={`/w/${slug}/notices/${notice.id}`}
      className="block min-h-11 border border-rule px-4 py-3 hover:border-plum"
    >
      <span className="block font-subhead text-display-sm break-words text-plum underline-offset-4">
        {notice.title}
      </span>
      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-body-sm">
        {notice.languages.map(({ language, written, stale }) => (
          <span key={language} className={written ? (stale ? "text-yarn" : "") : "text-ink/50"}>
            <span className="font-semibold">{LANGUAGE_CODE[language]}</span>{" "}
            {!written ? "—" : stale ? t["notices.staleShort"] : "✓"}
          </span>
        ))}
      </span>
      <span className="mt-1 block text-body-sm text-ink/80">{words.flags(notice).join(" · ")}</span>
      <span className="mt-1 block text-body-sm text-ink/70">
        {words.changed(notice.updatedBy, notice.updatedAt)}
      </span>
    </a>
  );
}

export default async function NoticesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { access, data: list } = await noticePage(slug, noticesList);
  const { language, t } = await workspaceWords();
  const words = noticeWords(language, t);
  return (
    <SignedInFrame access={access} language={language} t={t} current="notices">
      <h1 className="font-display text-display-lg">{t["tab.notices"]}</h1>
      <p className="mt-2 text-ink/80">{t["notices.lead"]}</p>
      <a
        href={`/w/${slug}/notices/new`}
        className={buttonClass("primary", "mt-4 w-full sm:w-auto")}
      >
        {t["notices.write"]}
      </a>
      {list.length === 0 ? (
        <p className="mt-4 border border-rule px-4 py-5">{t["notices.empty"]}</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {list.map((notice) => (
            <li key={notice.id}>
              <Card slug={slug} notice={notice} t={t} words={words} />
            </li>
          ))}
        </ul>
      )}
    </SignedInFrame>
  );
}
