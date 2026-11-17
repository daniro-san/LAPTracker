// The "To review" list on Home (issue 299): the workspace's drafts waiting for an officer, shared by all of
// them, and the door in, "Send screenshots". Each draft says what was read and how many rows need a person.
// Above them, "2 new members to match" when a roster read could not match new members added by hand, and
// each notice review request the officer may answer (D113), linked to its notice.
import { fill, isolate } from "@/lib/copy";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { MAX_PICTURES } from "@/lib/private/import";
import type { ImportKind, Scope } from "@/lib/private/import-kinds";
import { STATUS_BAR } from "@/lib/private/import-kinds";
import { SAVED_KINDS } from "@/lib/private/import-save";
import type { ReviewItem } from "@/lib/private/import-view";
import { draftCounts, kindLabel } from "@/lib/private/import-words";
import type { reviewsForMe } from "@/lib/private/notice-reviews";

import { LANGUAGE_CODE } from "./languages";
import { SendScreenshots, type TypeChoice } from "./SendScreenshots";

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

/** The types an officer can give a picture that was not recognised, with their tab. */
function choices(t: WorkspaceDictionary): TypeChoice[] {
  return SAVED_KINDS.flatMap((kind) => {
    const scopes: (Scope | null)[] =
      kind === "alliance_duel" || kind === "donation" ? ["daily", "weekly"] : [null];
    return scopes.map((scope) => ({ kind, scope, label: kindLabel(t, kind, scope) }));
  });
}

/** What every "Send screenshots" button takes: Home's, and each tab's with its types (D110). */
export function sendProps(slug: string, t: WorkspaceDictionary, language: WorkspaceLanguage) {
  return {
    slug,
    language,
    w: Object.fromEntries(Object.entries(t).filter(([k]) => k.startsWith("shots."))),
    kinds: Object.fromEntries(KINDS.map((k) => [k, t[`shots.kind.${k}`]])) as Record<
      ImportKind,
      string
    >,
    picks: choices(t),
    maxPictures: MAX_PICTURES,
    statusBar: STATUS_BAR,
  };
}

/**
 * Each tab's button and the types its pictures start as (D110): on Members a chat (member update) or an
 * Alliance Duel page, picked first; on Thefts a Secret Ops report. No button on Roll call: Elixir teams
 * are not saved yet (D103).
 */
const TABS = {
  members: { button: "shots.sendOne", kinds: ["member_update", "alliance_duel"] },
  thefts: { button: "shots.sendSecretOps", kinds: ["secret_ops"] },
} as const satisfies Record<string, { button: keyof WorkspaceDictionary; kinds: ImportKind[] }>;

export function TabSend(props: {
  slug: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  tab: keyof typeof TABS;
}) {
  const { t } = props;
  const { button, kinds } = TABS[props.tab];
  return (
    <SendScreenshots
      {...sendProps(props.slug, t, props.language)}
      button={t[button]}
      ask={t["shots.presetAsk"]}
      presets={kinds.map((kind) => ({ kind, label: t[`shots.kind.${kind}`] }))}
    />
  );
}

/** The notice review requests for this officer (D113), one link each to its notice. */
function NoticeReviewLinks(props: {
  slug: string;
  t: WorkspaceDictionary;
  reviews: Awaited<ReturnType<typeof reviewsForMe>>;
}) {
  const { t } = props;
  if (props.reviews.length === 0) return null;
  return (
    <ul className="mt-1">
      {props.reviews.map((r) => (
        <li key={r.id}>
          <a
            href={`/w/${props.slug}/notices/${r.noticeId}`}
            className="inline-flex min-h-11 items-center py-1 font-semibold text-plum underline underline-offset-4"
          >
            {fill(t["notices.review.home"], {
              title: isolate(r.title),
              what: r.language ? LANGUAGE_CODE[r.language] : t["notices.review.all"],
              name: r.askedBy ? isolate(r.askedBy) : t["notices.someone"],
            })}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function ToReview(props: {
  slug: string;
  items: ReviewItem[];
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  /** "2 new members to match" and its link to Members (D106, 2026-11-17); null when none. */
  toMatch: { line: string; href: string } | null;
  /** The open notice review requests for this officer (D113): "Review “Garden rota” · PT, asked by Ana". */
  reviews: Awaited<ReturnType<typeof reviewsForMe>>;
  /** "Mon 16 Nov 18:54 server time", per item. */
  when: (at: Date) => string;
}) {
  const { slug, items, t, language } = props;
  // Screenshot drafts and the notice reviews for this officer (D113).
  const waiting = items.length + props.reviews.length;
  return (
    <section aria-labelledby="to-review" className="mt-4 border border-rule px-4 py-4">
      <h2 id="to-review" className="font-subhead text-display-sm">
        {t["shots.head"]}
        {waiting > 0 && <span className="ml-2 tabular-nums text-plum">{waiting}</span>}
      </h2>
      {items.length > 0 && <p className="mt-1">{t["shots.lead"]}</p>}
      <NoticeReviewLinks slug={slug} t={t} reviews={props.reviews} />
      {props.toMatch && (
        <p className="mt-1">
          <a
            href={props.toMatch.href}
            className="inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4"
          >
            {props.toMatch.line}
          </a>
        </p>
      )}
      {/* The door in comes first, so it does not sink under a long queue (panel PD-4, UI-8). */}
      <SendScreenshots {...sendProps(slug, t, language)} />
      {waiting === 0 && <p className="mt-3">{t["shots.none"]}</p>}
      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((d) => (
            <li key={d.id}>
              <a
                href={`/w/${slug}/shots/${d.id}`}
                className="flex min-h-11 flex-col gap-0.5 border border-rule px-3 py-2"
              >
                <span className="font-semibold">{kindLabel(t, d.kind, d.scope, d.scopeSure)}</span>
                <span className="text-body-sm tabular-nums">{draftCounts(t, language, d)}</span>
                <span className="text-body-sm text-ink/75">
                  {[
                    d.sentBy &&
                      fill(t[d.source === "pasted" ? "shots.pastedBy" : "shots.sentBy"], {
                        name: isolate(d.sentBy),
                      }),
                    d.source === "discord" && t["shots.viaDiscord"],
                    props.when(d.createdAt),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="self-end text-body-sm font-semibold text-plum underline underline-offset-4">
                  {t["shots.open"]}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
