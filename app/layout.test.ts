// Brave iOS Night Mode runs Dark Reader, which recolours the light theme: the head must carry its lock tag.
import { describe, expect, it, vi } from "vitest";

vi.mock("./_ui/locale", () => ({
  requestCopy: async () => ({ site: { name: "LAP Tracker", description: "d" } }),
  requestLanguage: async () => ({ language: "en", locale: "en" }),
}));
vi.mock("./globals.css", () => ({}));
vi.mock("@/lib/brand/fonts", () => ({ fontVariables: "" }));

import { generateMetadata } from "./layout";

describe("app/layout.tsx metadata", () => {
  it("emits <meta name=darkreader-lock> so Night Mode stays off", async () => {
    const meta = await generateMetadata();
    expect(meta.other?.["darkreader-lock"]).toBeTruthy();
  });
});
