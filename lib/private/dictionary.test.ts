import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { fill } from "../copy";
import { dateWords } from "../date-words";
import { pickWorkspaceLanguage, WORKSPACE_DICTIONARIES } from "./dictionary";

describe("the workspace dictionary (D71, #305)", () => {
  it("has the same keys in en, pt-BR and fr, and no empty value", () => {
    const keys = Object.keys(WORKSPACE_DICTIONARIES.en).sort();
    for (const [language, words] of Object.entries(WORKSPACE_DICTIONARIES)) {
      expect(Object.keys(words).sort(), language).toEqual(keys);
      const empty = Object.entries(words).filter(([, v]) => v.trim() === "");
      expect(empty, language).toEqual([]);
    }
  });

  it("writes every time as ST and spells server time out only in a line that names ST (issue 585 batch 4)", () => {
    const FULL = {
      en: /server time/iu,
      "pt-BR": /horário do servidor/iu,
      fr: /heure du serveur/iu,
    };
    for (const [language, words] of Object.entries(WORKSPACE_DICTIONARIES)) {
      const full = FULL[language as keyof typeof FULL];
      const values = Object.values(words);
      expect(
        values.some((v) => full.test(v)),
        language,
      ).toBe(true);
      const bare = values.filter((v) => full.test(v) && !/\bST\b/u.test(v));
      expect(bare, language).toEqual([]);
    }
    // One full term per language: never "hora do servidor" or "heure serveur".
    const stray = (language: "pt-BR" | "fr", term: RegExp) =>
      Object.values(WORKSPACE_DICTIONARIES[language]).filter((v) => term.test(v));
    expect(stray("pt-BR", /\bhora do servidor/iu)).toEqual([]);
    expect(stray("fr", /heure serveur/iu)).toEqual([]);
  });

  it("fills every Portuguese and French line that ends a sentence with a date from the sentence or year form, at its caller (issue 585 batch 4)", () => {
    // The short form ends in "." ("nov."), so a line ending "{date}." printed "nov..". Each such line is
    // traced to the code that makes its date, and that code must be a `sentence` or `withYear` form;
    // switching one caller to `day` (or a new caller of the line) fails here.
    const ending = /\{(date|day)\}\.(\s|$)/u;
    const keys = new Set(
      (["pt-BR", "fr"] as const).flatMap((language) =>
        Object.entries(WORKSPACE_DICTIONARIES[language])
          .filter(([, text]) => ending.test(text))
          .map(([key]) => key),
      ),
    );
    expect([...keys].sort()).toEqual(Object.keys(SENTENCE_CALLERS).sort());
    const source = sourceFiles();
    const flat = (text: string) => text.replace(/\s+/gu, " ");
    for (const [key, links] of Object.entries(SENTENCE_CALLERS)) {
      // A plural line is named by its stem ("insights.flow.based") where `counted` picks the form.
      const refs = [`"${key}"`, `"${key.replace(/\.(one|other)$/u, "")}"`];
      const callers = [...source]
        .filter(([, text]) => refs.some((ref) => text.includes(ref)))
        .map(([file]) => file);
      expect(callers.length, key).toBeGreaterThan(0);
      for (const file of callers)
        expect(
          links.map(([f]) => f),
          `${key}: a caller not traced here`,
        ).toContain(file);
      for (const [file, code] of links)
        expect(flat(source.get(file) ?? ""), `${key} in ${file}`).toContain(flat(code));
    }
    // Why: the short form doubles the dot, the sentence form does not.
    const pt = dateWords("pt-BR", "Etc/GMT+2");
    const text = WORKSPACE_DICTIONARIES["pt-BR"]["deletion.banner"];
    expect(fill(text, { date: pt.day("2026-11-20") })).toContain("..");
    expect(fill(text, { date: pt.withYear("2026-11-20") })).not.toContain("..");
  });
});

/** Each line that ends a sentence with a date: every file on the way from its caller to its date form. */
const DELETION_FORM: [string, string] = [
  "app/(private)/_ui/Frame.tsx",
  'return dateWords(language, "UTC").withYear(at);',
];
const SENTENCE_CALLERS: Record<string, [string, string][]> = {
  "delete.asked": [
    [
      "app/(private)/_ui/WorkspaceDataForm.tsx",
      'fill(t["delete.asked"], { date: props.deletionDate })',
    ],
    [
      "app/(private)/w/[slug]/settings/page.tsx",
      "deletionDate: access.purgeAfter ? deletionDate(access.purgeAfter, language)",
    ],
    DELETION_FORM,
  ],
  "deletion.banner": [
    ["app/(private)/_ui/Frame.tsx", "const date = deletionDate(purgeAfter, props.language);"],
    DELETION_FORM,
  ],
  "deletion.board": [
    ["app/(private)/_ui/Frame.tsx", "const date = deletionDate(purgeAfter, props.language);"],
    DELETION_FORM,
  ],
  "followup.reason.kvk": [
    [
      "app/(private)/_ui/follow-up-groups.ts",
      'fill(t["followup.reason.kvk"], { date: dateWords(f.language, f.zone).sentence(kvkDay) })',
    ],
  ],
  "garrison.enemyCarried": [
    ["app/(private)/_ui/GarrisonEnemy.tsx", "{ date: props.carriedFrom }"],
    [
      "app/(private)/w/[slug]/calendar/garrison/page.tsx",
      "carriedFrom={view.carriedFrom && calendarDates(language).sentence(view.carriedFrom)}",
    ],
  ],
  "insights.flow.based.one": [
    [
      "lib/private/insights-words.ts",
      'counted(t, "insights.flow.based", flow.reads, language, { date: dates.sentence(flow.from),',
    ],
  ],
  "insights.flow.based.other": [
    [
      "lib/private/insights-words.ts",
      'counted(t, "insights.flow.based", flow.reads, language, { date: dates.sentence(flow.from),',
    ],
  ],
  "invite.expires": [
    [
      "app/(private)/w/(onboarding)/invite/page.tsx",
      'fill(t["invite.expires"], { date: dateWords(language, "UTC").sentence(view.expiresAt),',
    ],
  ],
  "notices.picture.keptBy": [
    ["app/(private)/_ui/NoticePictureKept.tsx", "date: props.kept.on,"],
    ["app/(private)/_ui/notice-pages.ts", "on: words.sentence(kept.at)"],
  ],
  "notices.pictures.one": [
    ["app/(private)/_ui/PicturesDue.tsx", 'dateWords(language, "UTC").sentence(day);'],
    ["app/(private)/_ui/PicturesDue.tsx", "const date = dayOf(first.after, props.language);"],
  ],
  "shots.draft.kept": [
    [
      "app/(private)/w/[slug]/shots/[id]/page.tsx",
      "date: dayOf(language).sentence(view.expiresAt),",
    ],
  ],
  "shots.draft.keptPasted": [
    [
      "app/(private)/w/[slug]/shots/[id]/page.tsx",
      "date: dayOf(language).sentence(view.expiresAt),",
    ],
  ],
  "thefts.reopened": [
    ["app/(private)/_ui/theft-data.ts", "day: f.sentence(last.changedAt),"],
    ["app/(private)/w/[slug]/thefts/page.tsx", "sentence: words.sentence,"],
  ],
};

/** The app's own source under app/ and lib/, tests and dictionaries left out: path → text. */
function sourceFiles(): Map<string, string> {
  const files = new Map<string, string>();
  for (const root of ["app", "lib"])
    for (const entry of readdirSync(root, { recursive: true, encoding: "utf8" })) {
      const file = `${root}/${entry}`;
      if (!/\.tsx?$/u.test(file) || /\.test\.ts$|\/dictionary[^/]*\.ts$/u.test(file)) continue;
      files.set(file, readFileSync(file, "utf8"));
    }
  return files;
}

describe("pickWorkspaceLanguage", () => {
  it("takes the switch's cookie over the browser's languages", () => {
    expect(pickWorkspaceLanguage("fr", "pt-BR,pt;q=0.9")).toBe("fr");
  });

  it("reads Portuguese from the browser as pt-BR", () => {
    expect(pickWorkspaceLanguage(undefined, "pt-BR,pt;q=0.9")).toBe("pt-BR");
  });

  it("reads a regional French as French", () => {
    expect(pickWorkspaceLanguage(undefined, "fr-CA")).toBe("fr");
  });

  it("falls back to English for a language the workspace is not written in", () => {
    expect(pickWorkspaceLanguage(undefined, "de-DE,ja;q=0.5")).toBe("en");
  });

  it("ignores a cookie that is not one of the three languages", () => {
    expect(pickWorkspaceLanguage("es", "fr")).toBe("fr");
  });

  it("finds nothing for object-prototype names in the header", () => {
    expect(pickWorkspaceLanguage(undefined, "__proto__,constructor")).toBe("en");
  });
});
