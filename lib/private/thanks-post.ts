// The weekly appreciation post's shape (issue 772, D114 amended 2026-11-27): a short opener, the officer's
// highlights (each person with "a few words", on their own line), then one line per reason with the names,
// then a closing line. Each person is named once. Plain text, so the game notice, Discord and the board's
// card show it the same. No number and no ranking (D75, D109). Imports nothing, so the sheet builds it in
// the browser for "I'll write it" and the server builds the same around the writing help's highlights.

export type Deed = "squad" | "ad" | "steady";
export type PostLanguage = "en" | "pt-BR" | "fr";

/** One person the post names: what they did this week and the officer's few words ("" when none). */
export interface PostPerson {
  name: string;
  did: readonly Deed[];
  note: string;
}

/** The deeds in the order a combined reason names them; AD Tech always first. */
const ORDER: readonly Deed[] = ["ad", "squad", "steady"];

const WORDS: Record<
  PostLanguage,
  {
    open: { this: string; last: string };
    close: string;
    reason: Record<Deed, string>;
    and: string;
    others: string;
    colon: string;
  }
> = {
  en: {
    open: {
      this: "Thank you for this week, everyone.",
      last: "Thank you for last week, everyone.",
    },
    close: "Thank you for playing with us.",
    reason: {
      ad: "Finished AD Tech",
      squad: "Grew their main squad",
      steady: "Kept up their daily quests and donations",
    },
    and: " and ",
    others: "Thank you as well",
    colon: ": ",
  },
  "pt-BR": {
    open: {
      this: "Obrigado por esta semana, pessoal.",
      last: "Obrigado pela semana passada, pessoal.",
    },
    close: "Obrigado por jogarem com a gente.",
    reason: {
      ad: "AD Tech concluído",
      squad: "Esquadrão principal maior",
      steady: "Missões diárias e doações em dia",
    },
    and: " e ",
    others: "Obrigado também a",
    colon: ": ",
  },
  fr: {
    open: {
      this: "Merci pour cette semaine, tout le monde.",
      last: "Merci pour la semaine dernière, tout le monde.",
    },
    close: "Merci de jouer avec nous.",
    reason: {
      ad: "AD Tech terminé",
      squad: "Escouade principale renforcée",
      steady: "Quêtes du jour et dons au rendez-vous",
    },
    and: " et ",
    others: "Merci aussi à",
    colon: " : ",
  },
};

/** "Finished AD Tech and grew their main squad": the reasons joined, only the first one capitalised. */
function reasonOf(did: readonly Deed[], language: PostLanguage): string {
  const w = WORDS[language];
  return ORDER.filter((d) => did.includes(d))
    .map((d, i) =>
      i === 0 ? w.reason[d] : w.reason[d].charAt(0).toLowerCase() + w.reason[d].slice(1),
    )
    .join(w.and);
}

/**
 * One group per reason, the people who did more first, then in ORDER; the people with no reason last ("Thank
 * you as well"). Names keep the order they were ticked in. The desk's "Say thanks to" shows the same groups.
 */
export function reasonGroups(
  people: readonly Pick<PostPerson, "name" | "did">[],
  language: PostLanguage,
): { label: string; names: string[] }[] {
  const groups = new Map<string, { did: Deed[]; names: string[] }>();
  for (const p of people) {
    const did = ORDER.filter((d) => p.did.includes(d));
    const key = did.join("+");
    const group = groups.get(key) ?? { did, names: [] };
    group.names.push(p.name);
    groups.set(key, group);
  }
  // More reasons first; among one reason, ORDER's; nobody's reason last.
  const rank = (did: Deed[]) =>
    did[0] === undefined ? -1 : did.length * 10 - ORDER.indexOf(did[0]);
  return [...groups.values()]
    .sort((a, b) => rank(b.did) - rank(a.did))
    .map((g) => ({
      label: g.did.length === 0 ? WORDS[language].others : reasonOf(g.did, language),
      names: g.names,
    }));
}

/** The label's colon in `language` (French puts a no-break space before it). */
export const reasonColon = (language: PostLanguage) => WORDS[language].colon;

const reasonLines = (people: readonly PostPerson[], language: PostLanguage) =>
  reasonGroups(people, language).map(
    (g) => `${g.label}${reasonColon(language)}${g.names.join(", ")}`,
  );

/**
 * The whole post in `language`. `highlights` are the lines for the people with the officer's words, in the
 * order given: the writing help's, or else each name with the words as typed ("Ana - carried the raid").
 */
export function thanksPost(
  people: readonly PostPerson[],
  language: PostLanguage,
  lastWeek: boolean,
  highlights?: readonly string[],
): string {
  const w = WORDS[language];
  const noted = people.filter((p) => p.note);
  const lines = highlights ?? noted.map((p) => `${p.name} - ${p.note}`);
  const rest = reasonLines(
    people.filter((p) => !p.note),
    language,
  );
  return [
    w.open[lastWeek ? "last" : "this"],
    ...(lines.length > 0 ? ["", ...lines] : []),
    ...(rest.length > 0 ? ["", ...rest] : []),
    "",
    w.close,
  ].join("\n");
}
