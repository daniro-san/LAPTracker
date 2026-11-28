// /w/[slug]/calendar/kvk?entry=&week= (issue 790, D161): a KvK entry's plan, from its Calendar entry's week.
// Roles with their people, a note, then "Make the message", which makes a notice draft the notice flow
// translates, copies and posts. Officers only (requireWorkspace, D71); under the Notices switch (D126).
import { notFound } from "next/navigation";

import { calendarDates, stOf, titleOf } from "@/lib/private/calendar-words";
import { kvkPlanEn, type KvkPlanWords } from "@/lib/private/dictionary.kvk-plan";
import { kvkPlanView } from "@/lib/private/kvk-plan";
import { DEFAULT_ROLES } from "@/lib/private/kvk-plan-message";

import { SignedInFrame } from "../../../../_ui/Frame";
import { KvkPlanEditor } from "../../../../_ui/KvkPlanEditor";
import { occasionOf, openRollCall } from "../../../../_ui/roll-call-page";
import { sheetWords } from "../../../../_ui/sheet-words";

const LINK =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";

export default async function KvkPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const occasion = occasionOf(await searchParams);
  if (!occasion || !("entry" in occasion)) notFound();
  const page = await openRollCall(
    params,
    `calendar/kvk?entry=${occasion.entry}&week=${occasion.week}`,
    (db, access, _today, _language, zone) =>
      kvkPlanView(db, access, occasion.entry, occasion.week, zone),
    "notices",
  );
  if (!page.data) notFound();
  const view = page.data;
  const { access, slug, t, language } = page;
  const words = Object.fromEntries(
    Object.keys(kvkPlanEn).map((k) => [k, t[k as keyof KvkPlanWords]]),
  ) as KvkPlanWords;
  const { placed } = view;
  return (
    <SignedInFrame access={access} language={language} t={t} current="days" waiting={page.waiting}>
      <p>
        <a href={`/w/${slug}/calendar?week=${placed.week}#d-${placed.day}`} className={LINK}>
          {`‹ ${t["kvkPlan.back"]}`}
        </a>
      </p>
      <h1 className="font-display text-display-lg">{t["kvkPlan.title"]}</h1>
      <p className="text-body-sm">
        {[
          titleOf(placed.entry, t),
          calendarDates(language).long(placed.day),
          stOf("kvk", placed.minute ?? 0, t),
        ].join(" · ")}
      </p>
      <p className="mt-2 text-body-sm">{t["kvkPlan.intro"]}</p>
      {/* A Confirm (issue 831) saves a new rev: the editor starts again from the saved plan. */}
      <KvkPlanEditor
        key={view.rev}
        slug={slug}
        entry={placed.entry.id}
        week={placed.week}
        roles={view.roles ?? DEFAULT_ROLES.map((k) => ({ name: t[k], uids: [] }))}
        suggested={view.roles === null}
        note={view.note}
        rev={view.rev}
        members={view.members}
        noticeId={view.noticeId}
        asks={view.asks}
        words={words}
        sheet={sheetWords(t)}
      />
    </SignedInFrame>
  );
}
