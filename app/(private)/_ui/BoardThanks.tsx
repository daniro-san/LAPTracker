// The members' board's "Thank you" card (issue 404, D114): the weekly appreciation post an officer chose to
// put there, as a handwritten note: the drawn pen frame in yarn, a warm paper tint, the red wax seal pressed
// on its corner, the letter in Alegreya, and the officer's name as the signature. The text shows in the
// viewer's language, the others one tap away (D105). Only this card's words: no value, no ranking. With no
// card (none shared, or taken down) nothing renders at all.
import { Wax } from "@/lib/brand/components/Wax";
import { YarnCorner } from "@/lib/brand/components/YarnCorner";
import { fill } from "@/lib/copy";
import type { BoardView } from "@/lib/private/board";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";

import { LanguageTag, Translated } from "./BoardText";
import { weekRange } from "./share-thanks-data";
import { ThanksTakeDown } from "./ThanksTakeDown";

export function BoardThanks(props: {
  thanks: BoardView["thanks"];
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  slug: string;
  /** An officer's preview: Take down is there. */
  officer: boolean;
}) {
  const { thanks, t, language } = props;
  if (!thanks) return null;
  const written = Object.keys(thanks.texts).filter((l) => thanks.texts[l]?.trim());
  return (
    <article
      aria-labelledby="board-thanks"
      className="drawn-frame relative mt-6 mr-3 bg-[color-mix(in_srgb,var(--yarn)_9%,var(--paper))] px-5 pt-5 pb-4 text-yarn"
    >
      <Wax tone="seal" className="absolute -top-4 -right-4 size-14 rotate-12" />
      <div className="text-ink">
        <h2 id="board-thanks" className="pr-10 font-display text-display-md">
          {t["board.thanks"]}
        </h2>
        <p className="text-body-sm text-ink/75">
          {fill(t["board.thanks.week"], { range: weekRange(thanks.week, t, language) })}
        </p>
        <LanguageTag t={t} language={language} written={written} />
        <Translated
          id="thanks"
          t={t}
          language={language}
          written={written}
          body={(l) => (
            <p
              translate="no"
              className="mt-2 font-display text-[1.125rem] leading-relaxed break-words whitespace-pre-wrap"
            >
              {thanks.texts[l]}
            </p>
          )}
        />
        {/* The ball of yarn rests in the corner, its thread running towards the signature. */}
        <div className="mt-3 flex items-end justify-between gap-3">
          <YarnCorner className="-mb-2 -ml-2 h-10 w-24 shrink-0 text-yarn" />
          <p className="text-right font-display text-[1.125rem] text-plum">
            {thanks.by ? (
              <>
                {t["board.thanks.from"].split("{name}")[0]}
                <bdi translate="no">{thanks.by}</bdi>
                {t["board.thanks.from"].split("{name}")[1]}
              </>
            ) : (
              t["board.thanks.officers"]
            )}
          </p>
        </div>
        {props.officer && (
          <ThanksTakeDown
            slug={props.slug}
            id={thanks.id}
            words={{
              takeDown: t["board.thanks.takeDown"],
              ask: t["board.thanks.ask"],
              keep: t["board.thanks.keep"],
              failed: t["board.thanks.failed"],
            }}
          />
        )}
      </div>
    </article>
  );
}
