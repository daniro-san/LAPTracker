// /w/[slug]/shots/[id] (issue 299): one draft of the screenshot import, for any officer of the workspace to
// check, fix and save. The access check runs before anything is read (D71). Numbers and dates are formatted
// here, in the officer's language, and the review itself is a client component.
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { exact } from "@/app/_ui/format";
import { buttonClass } from "@/lib/brand/components/Button";
import { fill, isolate } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import { requireWorkspace } from "@/lib/private/access";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { featureOn } from "@/lib/private/features";
import type { ImportKind } from "@/lib/private/import-kinds";
import { SAVED_KINDS } from "@/lib/private/import-save";
import { draftView, toReview, type DraftView } from "@/lib/private/import-view";
import { counted, kindLabel } from "@/lib/private/import-words";
import { RENEW_MS } from "@/lib/private/session";
import { SLUG } from "@/lib/private/sign-in";

import { type ReviewText } from "../../../../_ui/DraftHeader";
import { DraftReview } from "../../../../_ui/DraftReview";
import { SignedInFrame, workspaceWords } from "../../../../_ui/Frame";
import { refuse } from "../../../../_ui/refuse";
import { SourceBadge } from "../../../../_ui/SourceBadge";

const DAY_MS = 86_400_000;
const KINDS: ImportKind[] = [
  "alliance_duel",
  "donation",
  "might",
  "kills",
  "secret_ops",
  "member_update",
  "damage_event",
  "undead_mail",
  "elixir_teams",
];

/** The import's words for the client: every `shots.*` key and the sheet frame's. */
const importWords = (t: WorkspaceDictionary) =>
  Object.fromEntries(
    Object.entries(t).filter(([k]) => k.startsWith("shots.") || k.startsWith("sheet.")),
  );

/** "Mon 16 Nov": a server day, as a date (the days are UTC dates). */
const dayOf = (language: WorkspaceLanguage) =>
  new Intl.DateTimeFormat(language, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

function reviewText(
  view: DraftView,
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
): ReviewText {
  const day = dayOf(language);
  const at = (iso: string, back = 0) => day.format(new Date(Date.parse(`${iso}T00:00:00Z`) - back));
  const monday = view.week[0] as string;
  const sixDays = (back: number) => view.week.slice(0, 6).map((d) => at(d, back));
  const index = view.week.indexOf(view.pictureDay);
  return {
    weeks: [
      fill(t["shots.draft.weekOf"], { date: at(monday) }),
      fill(t["shots.draft.weekOf"], { date: at(monday, 7 * DAY_MS) }),
    ],
    days: [sixDays(0), sixDays(7 * DAY_MS)],
    pictureDay: index >= 0 && index <= 5 ? index : 5,
  };
}

export default async function DraftPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  if (!SLUG.test(slug) || !/^\d{1,9}$/.test(id)) notFound();
  const jar = await cookies();
  const now = new Date();
  // INVARIANT workspace.access-first: nothing private is read before this check.
  const { access, view, open } = await withPageDb(async (db) => {
    const access = await requireWorkspace(db, slug, jar, now, RENEW_MS);
    if (!access.ok) return { access, open: [], view: null };
    const [open, view] = await Promise.all([
      toReview(db, access, now),
      draftView(db, access, Number(id), now),
    ]);
    return { access, open, view };
  });
  if (!access.ok) {
    refuse(slug, access.reason, `/w/${slug}/shots/${id}`);
    redirect(`/w/${slug}`);
  }
  const { language, t } = await workspaceWords();
  const kinds = Object.fromEntries(KINDS.map((k) => [k, t[`shots.kind.${k}`]])) as Record<
    ImportKind,
    string
  >;
  // The other drafts waiting, in Home's order: once this one is saved or discarded, the next is one tap.
  const others = open.filter((d) => d.id !== Number(id));
  return (
    <SignedInFrame access={access} language={language} t={t} current="home" waiting={open.length}>
      <p>
        <a
          href={`/w/${slug}`}
          className="inline-flex min-h-11 items-center underline underline-offset-4"
        >
          ← {t["shots.draft.back"]}
        </a>
      </p>
      {view === null ? (
        <p className="drawn-card mt-4 px-4 py-5">{t["shots.e.gone"]}</p>
      ) : (
        <Draft
          view={view}
          t={t}
          language={language}
          slug={slug}
          kinds={kinds}
          thefts={featureOn(access, "thefts")}
        />
      )}
      {view?.status !== "open" && (
        <NextDraft slug={slug} t={t} language={language} others={others} />
      )}
    </SignedInFrame>
  );
}

/** After a save or discard (or on a draft that is gone): "Next draft (n left) →", or Home when none is
 * left (panel PD-4). */
function NextDraft(props: {
  slug: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  others: { id: number }[];
}) {
  const { slug, t, others } = props;
  const next = others[0];
  const form =
    new Intl.PluralRules(props.language).select(others.length) === "one" ? "one" : "other";
  return (
    <p className="mt-6">
      <a
        href={next ? `/w/${slug}/shots/${next.id}` : `/w/${slug}`}
        className={buttonClass(next ? "primary" : "secondary", "w-full sm:w-auto")}
      >
        {next
          ? `${fill(t[`shots.nextDraft.${form}`], { n: others.length })} →`
          : t["shots.draft.back"]}
      </a>
    </p>
  );
}

function Draft(props: {
  view: DraftView;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  slug: string;
  kinds: Record<ImportKind, string>;
  thefts: boolean;
}) {
  const { view, t, language } = props;
  const by = view.doneBy ?? t["shots.someone"];
  // Lines from "Paste updates" (D109): no picture, so neither "from a screenshot" nor "not kept".
  const pasted = view.source === "pasted";
  return (
    <>
      <h1 className="mt-2 font-display text-display-lg">
        {kindLabel(t, view.kind, view.scope, view.scopeSure)}
      </h1>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-body-sm text-ink/80">
        <span>{counted(t, language, "shots.rows", view.rows.length)}</span>
        {!pasted && <SourceBadge source="photo" label={t["src.photo"]} />}
      </p>
      <p className="mt-1 text-body-sm text-ink/80">
        {[
          view.sentBy && fill(t[pasted ? "shots.pastedBy" : "shots.sentBy"], { name: view.sentBy }),
          view.source === "discord" && t["shots.viaDiscord"],
          view.pages > 1 && fill(t["shots.draft.pages"], { n: view.pages }),
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p className="mt-1 text-body-sm text-ink/80">
        {fill(t[pasted ? "shots.draft.keptPasted" : "shots.draft.kept"], {
          date: dayOf(language).format(view.expiresAt),
        })}
      </p>
      {view.leftOut > 0 && (
        <p className="mt-2 border-l-4 border-yarn pl-2">
          {counted(t, language, "shots.leftOut", view.leftOut)}
        </p>
      )}
      {view.status !== "open" && (
        <p role="status" className="mt-3 border-l-4 border-plum pl-3 font-semibold">
          {fill(t[view.status === "saved" ? "shots.savedBy" : "shots.discardedBy"], {
            name: isolate(by),
          })}
        </p>
      )}
      <DraftReview
        key={view.version}
        slug={props.slug}
        view={view}
        w={importWords(t)}
        kinds={props.kinds}
        saveKinds={SAVED_KINDS}
        text={reviewText(view, t, language)}
        sep={exact(1000, language).replace(/\d/g, "")}
        thefts={props.thefts}
      />
    </>
  );
}
