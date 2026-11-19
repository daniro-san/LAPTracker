// /w/[slug]/notices (issue 304): the leadership's notices library, the most recently changed first. One card
// per notice: its title, which languages are written and which may be out of date, whether members see it
// and until when, and who changed it last. The access check runs before anything is read (D71). After a
// delete, "Notice deleted." with Undo (D118).
import { buttonClass } from "@/lib/brand/components/Button";
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { noticesList, type NoticeSummary } from "@/lib/private/notices";

import { CalendarNav } from "../../../_ui/CalendarNav";
import { SignedInFrame, workspaceWords } from "../../../_ui/Frame";
import { LANGUAGE_CODE } from "../../../_ui/languages";
import { noticePage, noticeWords } from "../../../_ui/notice-pages";
import { DeletedLine } from "../../../_ui/NoticeDelete";

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
      className="drawn-card tint-button block min-h-11 px-4 py-3"
    >
      <span className="block font-subhead text-display-sm break-words text-plum underline-offset-4">
        {notice.title}
      </span>
      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-body-sm">
        {notice.languages.map(({ language, written, stale }) => {
          const state = !written ? "missing" : stale ? "stale" : "fresh";
          const tone = { missing: "text-ink/60", stale: "font-semibold text-yarn", fresh: "" }[
            state
          ];
          return (
            <span key={language} className={tone}>
              {fill(t[`notices.status.${state}`], { lang: LANGUAGE_CODE[language] })}
            </span>
          );
        })}
      </span>
      <span className="mt-1 block text-body-sm text-ink/80">{words.flags(notice).join(" · ")}</span>
      <span className="mt-1 block text-body-sm text-ink/70">
        {words.changed(notice.updatedBy, notice.updatedAt)}
      </span>
    </a>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default async function NoticesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  // Just deleted (D118): ?deleted=<id>&undo=<the delete's request id> shows the line with Undo.
  const { deleted, undo } = await searchParams;
  const just =
    typeof deleted === "string" &&
    /^[1-9]\d{0,8}$/.test(deleted) &&
    typeof undo === "string" &&
    UUID.test(undo)
      ? { id: Number(deleted), requestId: undo }
      : null;
  const { access, data: list, waiting, off } = await noticePage(slug, noticesList, "");
  if (off) return off;
  const { language, t } = await workspaceWords();
  const words = noticeWords(language, t);
  return (
    <SignedInFrame access={access} language={language} t={t} current="notices" waiting={waiting}>
      <h1 className="font-display text-display-lg">{t["tab.notices"]}</h1>
      {/* Notices are a view of the Calendar tab (Week · Caravans · Notices, issue 300). */}
      <CalendarNav slug={slug} current="notices" t={t} on={access.features.on} />
      <p className="mt-2 text-ink/80">{t["notices.lead"]}</p>
      <a
        href={`/w/${slug}/notices/new`}
        className={buttonClass("primary", "mt-4 w-full sm:w-auto")}
      >
        {t["notices.write"]}
      </a>
      {just && <DeletedLine key={just.requestId} slug={slug} {...just} t={t} />}
      {list.length === 0 ? (
        <p className="drawn-card mt-4 px-4 py-5">{t["notices.empty"]}</p>
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
