// Plan §12.3 / Phase 5b: the error page renders none of the thrown error's text.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DATA_UNAVAILABLE } from "@/lib/data-unavailable";

import ErrorBoundary from "./error";

// The boundary's Try again refreshes through the app router, which a static render does not mount.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

describe("app/error.tsx", () => {
  it("renders no part of the thrown error's message, digest or stack", () => {
    const error = Object.assign(new Error("db password=hunter2 at neon-host-7f3a"), {
      digest: "DIGEST-5d41402abc",
    });
    error.stack = `Error: db password=hunter2\n    at secretModule (/srv/app/lib/secret-path.ts:12:7)`;

    const html = renderToStaticMarkup(createElement(ErrorBoundary, { error, reset: () => {} }));

    expect(html).toContain("Something cracked.");
    for (const leak of [
      "hunter2",
      "neon-host-7f3a",
      "DIGEST-5d41402abc",
      "secret-path",
      "secretModule",
    ]) {
      expect(html).not.toContain(leak);
    }
  });
});

describe("app/error.tsx when the database does not answer (D143)", () => {
  it("says the data is temporarily unavailable", () => {
    const error = Object.assign(new Error("database unavailable"), { digest: DATA_UNAVAILABLE });

    const html = renderToStaticMarkup(createElement(ErrorBoundary, { error, reset: () => {} }));

    expect(html).toContain("Data temporarily unavailable.");
    expect(html).not.toContain("Something cracked.");
  });
});
