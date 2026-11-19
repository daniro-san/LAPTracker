// /w/[slug]/notices/pictures (D119, owner 2026-11-18): the weekly cleanup's review list, opened from Home's
// warning card. Each notice picture due within 7 days and not kept, the soonest first: a thumbnail, the
// notice's title, the day after which it may be deleted, and Keep, Download and "Use in another notice".
// The access check runs before anything is read (D71).
import { getEnv } from "@/lib/env";
import { picturesDue } from "@/lib/private/notice-picture-due";
import { noticesList } from "@/lib/private/notices";

import { SignedInFrame, workspaceWords } from "../../../../_ui/Frame";
import { noticePage } from "../../../../_ui/notice-pages";
import { PicturesDueList } from "../../../../_ui/PicturesDue";

export default async function PicturesDuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { language, t } = await workspaceWords();
  const { access, data, waiting } = await noticePage(
    slug,
    async (db, a) => {
      const [due, notices] = await Promise.all([
        picturesDue(db, a, new Date(), getEnv()),
        noticesList(db, a),
      ]);
      return { due, targets: notices.map((n) => ({ id: n.id, title: n.title })) };
    },
    "/pictures",
  );
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
      <h1 className="font-display text-display-lg">{t["notices.pictures.title"]}</h1>
      <p className="mt-2 max-w-2xl">{t["notices.pictures.lead"]}</p>
      <PicturesDueList
        slug={slug}
        t={t}
        language={language}
        items={data.due}
        targets={data.targets}
      />
    </SignedInFrame>
  );
}
