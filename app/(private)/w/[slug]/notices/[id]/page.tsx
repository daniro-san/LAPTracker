// /w/[slug]/notices/[id] (issue 304): one notice, read in each language with its copies, its editor with the
// earlier versions, "Publish to Discord" and the calendar link (issue 345, D102). A notice of another
// workspace is a 404, like one that does not exist (D71). Review requests (D113): the open ones on top, the
// "Review" section with the answered ones and "Ask for a review".
import { notFound } from "next/navigation";

import { getAppContext } from "@/lib/app-context";
import { getEnv } from "@/lib/env";
import { audienceOf, lastPublish, noticeChannels } from "@/lib/private/notice-publish";
import { noticeReviews } from "@/lib/private/notice-reviews";
import { noticeDetail, noticeHistory } from "@/lib/private/notices";
import { serverDay } from "@/lib/schedule";

import { SignedInFrame, workspaceWords } from "../../../../_ui/Frame";
import { noticeCalendar } from "../../../../_ui/notice-calendar";
import {
  languagesFor,
  noticePage,
  noticeWords,
  reviewProps,
  sourceFor,
} from "../../../../_ui/notice-pages";
import { NoticeScreen } from "../../../../_ui/NoticeScreen";

export default async function NoticePage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id: raw } = await params;
  const id = /^[1-9]\d{0,8}$/.test(raw) ? Number(raw) : null;
  if (id === null) notFound();
  const { language, t } = await workspaceWords();
  const { access, data, waiting } = await noticePage(
    slug,
    async (db, a) => {
      const notice = await noticeDetail(db, a, id);
      if (!notice) return null;
      const [history, last, calendar, reviews] = await Promise.all([
        noticeHistory(db, a, id),
        lastPublish(db, a, id),
        noticeCalendar(db, a, id, serverDay(new Date(), getEnv()), { t, language }),
        noticeReviews(db, a, id),
      ]);
      return { notice, history, last, calendar, reviews };
    },
    `/${id}`,
  );
  if (!data) notFound();
  const { notice, history, last, calendar, reviews } = data;
  const words = noticeWords(language, t);
  const languages = languagesFor(language);
  const audience = audienceOf(notice.forMembers);
  const channels = noticeChannels(getEnv(), slug);
  const nameOf = (a: string) =>
    channels[a === "members" ? "members" : "leaders"]?.name.replace(/^#/, "") ?? null;
  const channel = nameOf(audience);
  // A new version of any field or of the picture (D119) remounts the screen, so a save or a refresh closes the
  // editor.
  const versions = Object.values(notice.fields).map((f) => f.version);
  const key = [...versions, notice.picture?.src].join(".");
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
        picture={notice.picture}
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
        history={history.versions.map((v) => ({
          id: v.id,
          line: words.version(v.by, v.at),
          changes: v.changes,
        }))}
        historyCut={history.cut}
        publish={{
          audience,
          channel,
          last: words.posted(last, last && nameOf(last.audience)),
        }}
        calendar={calendar}
        reviews={reviewProps(words, t, reviews, access.user.id)}
      />
    </SignedInFrame>
  );
}
