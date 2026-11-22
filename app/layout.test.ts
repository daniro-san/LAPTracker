// Brave iOS Night Mode runs Dark Reader, which recolours the light theme: the head must carry its lock tag.
import { describe, expect, it, vi } from "vitest";

// The real requestCopy runs on an English request: only Next's request APIs are replaced.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers({ "accept-language": "en" }),
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
