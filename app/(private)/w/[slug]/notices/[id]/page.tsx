// /w/[slug]/notices/[id] (issue 304): one notice, read in each language with its copies, its editor with the
// earlier versions, "Publish to Discord" and the calendar link (issue 345, D102). A notice of another
// workspace is a 404, like one that does not exist (D71). Review requests (D113): the open ones on top, the
// "Review" section with the answered ones and "Ask for a review".
import { notFound } from "next/navigation";

import { getAppContext } from "@/lib/app-context";
import { getEnv } from "@/lib/env";
import { channelNames } from "@/lib/private/discord-webhooks";
import { memberLanguages } from "@/lib/private/notice-languages";
import { audienceOf, lastPublish } from "@/lib/private/notice-publish";
import { noticeReviews } from "@/lib/private/notice-reviews";
import { noticeDetail, noticeHistory } from "@/lib/private/notices";
import { serverDay } from "@/lib/schedule";

import { SignedInFrame, workspaceWords } from "../../../../_ui/Frame";
import { noticeCalendar } from "../../../../_ui/notice-calendar";
import {
  editorSwitches,
  languagesFor,
  noticePage,
  noticeWords,
  reviewProps,
  savedStates,
  sourceFor,
} from "../../../../_ui/notice-pages";
import { NoticeScreen } from "../../../../_ui/NoticeScreen";

const versionOf = (field: { version: number }) => field.version;

export default async function NoticePage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id: raw } = await params;
  const id = /^[1-9]\d{0,8}$/.test(raw) ? Number(raw) : null;
  if (id === null) notFound();
  const { language, t } = await workspaceWords(slug);
  const { access, data, waiting } = await noticePage(
    slug,
    async (db, a) => {
      const notice = await noticeDetail(db, a, id);
      if (!notice) return null;
      const [history, last, calendar, reviews, channels, spoken] = await Promise.all([
        noticeHistory(db, a, id),
        lastPublish(db, a, id),
        noticeCalendar(db, a, id, serverDay(new Date(), getEnv()), { t, language }),
        noticeReviews(db, a, id),
        // Only the channels' names reach the page, never their webhooks (D102, D129).
        channelNames(db, a, getEnv()),
        memberLanguages(db, a, new Date()),
      ]);
      return { notice, history, last, calendar, reviews, channels, spoken };
    },
    `/${id}`,
  );
  if (!data) notFound();
  const { notice, history, last, calendar, reviews, channels, spoken } = data;
  const languages = languagesFor(language);
  const words = noticeWords(language, t);
  const audience = audienceOf(notice.forMembers);
  const nameOf = (a: string) =>
    channels[a === "members" ? "members" : "leaders"]?.replace(/^#/, "") ?? null;
  // A new version of any field remounts the screen, so a save or a refresh closes the editor. A picture
  // change does not (D119): the editor closes itself after a picture-only save, and stays open, in step with
  // the stored picture, when the text save after it fails.
  const key = Object.values(notice.fields).map(versionOf).join(".");
  return (
    <SignedInFrame access={access} language={language} t={t} current="notices" waiting={waiting}>
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
        {...editorSwitches(access, notice.picture && words.picture(notice.picture, notice.kept))}
        {...savedStates(notice, reviews.list)}
        t={t}
        viewer={language}
        ai={getAppContext().ai !== null}
        memberLanguages={spoken}
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
          channel: nameOf(audience),
          last: words.posted(last, last && nameOf(last.audience)),
        }}
        calendar={calendar}
        reviews={reviewProps(words, t, reviews, access.user.id)}
      />
    </SignedInFrame>
  );
}
