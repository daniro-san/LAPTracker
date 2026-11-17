// The "To review" list on Home (issue 299): the workspace's drafts waiting for an officer, shared by all of
// them, and the door in, "Send screenshots". Each draft says what was read and how many rows need a person.
// Above them, "2 new members to match" when a roster read could not match new members added by hand.
import { fill, isolate } from "@/lib/copy";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { ImportKind, Scope } from "@/lib/private/import-kinds";
import { STATUS_BAR } from "@/lib/private/import-kinds";
import { SAVED_KINDS } from "@/lib/private/import-save";
import type { ReviewItem } from "@/lib/private/import-view";
import { draftCounts, kindLabel } from "@/lib/private/import-words";

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

export function ToReview(props: {
  slug: string;
  items: ReviewItem[];
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  maxPictures: number;
  /** "2 new members to match" and its link to Members (D106, 2026-11-17); null when none. */
  toMatch: { line: string; href: string } | null;
  /** "Mon 16 Nov 18:54 server time", per item. */
  when: (at: Date) => string;
}) {
  const { slug, items, t, language } = props;
  return (
    <section aria-labelledby="to-review" className="mt-4 border border-rule px-4 py-4">
      <h2 id="to-review" className="font-subhead text-display-sm">
        {t["shots.head"]}
        {items.length > 0 && <span className="ml-2 tabular-nums text-plum">{items.length}</span>}
      </h2>
      {items.length > 0 && <p className="mt-1">{t["shots.lead"]}</p>}
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
      <SendScreenshots
        slug={slug}
        language={language}
        w={Object.fromEntries(Object.entries(t).filter(([k]) => k.startsWith("shots.")))}
        kinds={
          Object.fromEntries(KINDS.map((k) => [k, t[`shots.kind.${k}`]])) as Record<
            ImportKind,
            string
          >
        }
        picks={choices(t)}
        maxPictures={props.maxPictures}
        statusBar={STATUS_BAR}
      />
      {items.length === 0 ? (
        <p className="mt-3">{t["shots.none"]}</p>
      ) : (
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
                    d.sentBy && fill(t["shots.sentBy"], { name: isolate(d.sentBy) }),
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
