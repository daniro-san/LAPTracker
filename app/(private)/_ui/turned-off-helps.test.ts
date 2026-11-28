// D126 amended (issue 483): a help turned off for the alliance is simply not there, with no line that says
// it is turned off: the writing helps in the notice editor and Start here, and "Read from a screenshot".
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { NOTICE_FIELDS, NOTICE_LANGUAGES } from "@/lib/private/notice-rules";

import { editorWords } from "./facts-form";
import { Paste } from "./FactsEditorParts";
import type { NoticeFields } from "./notice-client";
import { startDraft } from "./notice-draft";
import type { Editor, EditorProps } from "./notice-editor-state";
import { NoticeActions } from "./NoticeActions";
import { StartHereEditor } from "./StartHereEditor";

const t = WORKSPACE_DICTIONARIES.en;

function noticeActions(
  aiOff: EditorProps["aiOff"],
  memberLanguages?: EditorProps["memberLanguages"],
) {
  const fields = Object.fromEntries(
    NOTICE_FIELDS.map((f) => [f, { value: f === "en" ? "Rally at 20:00." : "", version: 0 }]),
  ) as NoticeFields;
  const p = {
    t,
    viewer: "en",
    ai: true,
    aiOff,
    memberLanguages,
    languages: [...NOTICE_LANGUAGES],
  } as EditorProps;
  const e = { active: "en", draft: startDraft(fields), wroteIn: null, busy: null } as Editor;
  return renderToStaticMarkup(createElement(NoticeActions, { p, e }));
}

function startHere(aiOff: readonly ("translate" | "improve")[]) {
  const text = { glossary: "Rally: a group attack.", rules: "", ask: "" };
  return renderToStaticMarkup(
    createElement(StartHereEditor, {
      slug: "ogs",
      ai: true,
      aiOff,
      languages: NOTICE_LANGUAGES,
      first: "en",
      texts: { en: text, "pt-BR": text, fr: text },
      versions: { en: 1, "pt-BR": 1, fr: 1 },
      max: { glossary: 4000, rules: 3000, ask: 1500 },
      t,
      viewer: "en",
    }),
  );
}

const paste = (shots: boolean) =>
  renderToStaticMarkup(
    createElement(Paste, {
      slug: "ogs",
      words: editorWords(t),
      shots,
      language: "en",
      open: true,
      onRead: () => 0,
    }),
  );

describe("helps turned off for the alliance are left out, with no line (D126, issue 483)", () => {
  it("the notice editor and Start here show no writing help and no line about it", () => {
    expect(noticeActions([])).toContain(t["notices.translate"]);
    expect(noticeActions(["translate", "improve", "fit"])).toBe("");
    expect(startHere([])).toContain(t["notices.translate"]);
    const off = startHere(["translate", "improve"]);
    expect(off).not.toContain(t["notices.translate"]);
    expect(off).not.toMatch(/turned off/i);
  });

  it('the paste box has no "Read from a screenshot" while reading screenshots is off', () => {
    expect(paste(true)).toContain(t["shot.read"]);
    const off = paste(false);
    expect(off).not.toContain(t["shot.read"]);
    expect(off).not.toMatch(/turned off/i);
  });
});

describe("the members' game languages beside Translate (issue 794)", () => {
  const counted = { read: 31, total: 40, counts: [{ language: "en", n: 18 }], other: 2 } as const;
  const members = { ...counted, counts: [...counted.counts] };

  it("shows the counts with how many members were read, and nothing without them", () => {
    const shown = noticeActions([], members);
    expect(shown).toContain("Members’ game languages: English 18 · Other 2");
    expect(shown).toContain("from 31 of 40 members");
    expect(noticeActions([], null)).not.toContain("Members’ game languages");
  });

  it("is left out with Translate, with no line about it", () => {
    const off = noticeActions(["translate"], members);
    expect(off).not.toContain("Members’ game languages");
    expect(off).not.toMatch(/turned off/i);
  });
});
