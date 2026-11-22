// The members' board's "Thank you" card (issue 404, D114): the weekly appreciation post an officer chose to
// put there, as a handwritten note: the drawn pen frame in yarn, a warm paper tint, the red wax seal pressed
// whole on its top edge, the ball of yarn beside the signature, the letter in Alegreya with each person on
// their own line and their name in bold, and the officer's name as the signature. The text shows in the
// viewer's language, the others one tap away (D105). Only this card's words: no value, no ranking. With no
// card (none shared, or taken down) nothing renders at all. An officer's Take down sits under the card.
import type { ReactNode } from "react";

import { Wax } from "@/lib/brand/components/Wax";
import { YarnCorner } from "@/lib/brand/components/YarnCorner";
import type { BoardView } from "@/lib/private/board";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { fill } from "@/lib/words";

import { LanguageTag, Translated } from "./BoardText";
import { weekRange } from "./share-thanks-data";
import { ThanksTakeDown } from "./ThanksTakeDown";

/** The officer's name as a signature: without a rank tag such as "(R4)" or "[R5]" at its end. */
export const signedName = (name: string) => name.replace(/\s*[([]\s*R\d\s*[)\]]\s*$/i, "").trim();

/** One line of the letter, each named person in bold; the longest name is matched first. */
function withBoldNames(line: string, names: readonly string[]): ReactNode[] {
  const known = [...names].filter((n) => n.trim()).sort((a, b) => b.length - a.length);
  if (known.length === 0) return [line];
  const pattern = new RegExp(
    `(${known.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
  );
  return line.split(pattern).map((part, i) =>
    known.includes(part) ? (
      // Alegreya is loaded at 400 only: the name takes the loaded bold of Alegreya Sans.
      <strong key={i} className="font-subhead font-bold">
        <bdi>{part}</bdi>
      </strong>
    ) : (
      part
    ),
  );
}

/** The letter: one paragraph per line, with a small gap between them (blank lines add nothing more). */
function Letter({ text, names }: { text: string; names: readonly string[] }) {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  return (
    <div translate="no" className="mt-2 font-display text-[1.125rem] leading-relaxed break-words">
      {lines.map((line, i) => (
        <p key={i} className="mt-2 first:mt-0">
          {withBoldNames(line, names)}
        </p>
      ))}
    </div>
  );
}

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
  const [before, after] = t["board.thanks.from"].split("{name}");
  return (
    <>
      <article
        aria-labelledby="board-thanks"
        className="drawn-frame relative mt-8 bg-[color-mix(in_srgb,var(--yarn)_9%,var(--paper))] px-5 pt-5 pb-4 text-yarn"
      >
        <Wax tone="seal" className="absolute -top-6 right-4 size-14 rotate-12" />
        <div className="text-ink">
          <h2 id="board-thanks" className="pr-16 font-display text-display-md">
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
            body={(l) => <Letter text={thanks.texts[l] ?? ""} names={thanks.names} />}
          />
          {/* The ball of yarn rests in the corner, its thread running towards the signature. */}
          <div className="mt-3 flex items-end justify-between gap-3">
            <YarnCorner className="-mb-2 -ml-2 h-14 w-32 shrink-0 text-yarn" />
            <p className="text-right font-display text-[1.125rem]">
              {thanks.by ? (
                <>
                  {before}
                  <bdi translate="no">{signedName(thanks.by)}</bdi>
                  {after}
                </>
              ) : (
                t["board.thanks.officers"]
              )}
            </p>
          </div>
        </div>
      </article>
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
    </>
  );
}
