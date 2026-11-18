// The build's source-map step (D115), with a stand-in for posthog-cli: nothing is sent to PostHog.
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { finishSourceMaps, POSTHOG_PROJECT_ID, type Runner } from "./sourcemaps";

let dir = "";

/** A built .next/static with one chunk and its map in a nested folder. */
function built(): string {
  dir = mkdtempSync(join(tmpdir(), "maps-"));
  mkdirSync(join(dir, "chunks"));
  writeFileSync(join(dir, "chunks", "a.js"), "x");
  writeFileSync(join(dir, "chunks", "a.js.map"), "{}");
  return dir;
}

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("finishSourceMaps (D115)", () => {
  it("without the personal key: runs no upload, the build goes on, and no map is left", () => {
    const run = vi.fn<Runner>(() => 0);
    const said = finishSourceMaps({}, built(), run);
    expect(run).not.toHaveBeenCalled();
    expect(said).toBe(
      "source maps: no POSTHOG_PERSONAL_API_KEY, nothing uploaded; 1 left-over map files deleted",
    );
    expect(existsSync(join(dir, "chunks", "a.js.map"))).toBe(false);
    expect(existsSync(join(dir, "chunks", "a.js"))).toBe(true);
  });

  it("with the key: hands it to the CLI's environment only, and deletes the maps even when the upload fails", () => {
    const run = vi.fn<Runner>(() => 1);
    const said = finishSourceMaps(
      { POSTHOG_PERSONAL_API_KEY: "phx_test", VERCEL_GIT_COMMIT_SHA: "abc123" },
      built(),
      run,
    );
    const [args, env] = run.mock.calls[0] ?? [[], {}];
    expect(args).toEqual([
      "sourcemap",
      "process",
      "--directory",
      dir,
      "--delete-after",
      "--release-name",
      "laptracker",
      "--release-version",
      "abc123",
    ]);
    expect(args.join(" ")).not.toContain("phx_test");
    expect(env).toEqual({
      POSTHOG_CLI_API_KEY: "phx_test",
      POSTHOG_CLI_PROJECT_ID: POSTHOG_PROJECT_ID,
      POSTHOG_CLI_HOST: "https://us.posthog.com",
    });
    expect(said).toBe("source maps: upload failed (exit 1); 1 left-over map files deleted");
    expect(said).not.toContain("phx_test");
    expect(existsSync(join(dir, "chunks", "a.js.map"))).toBe(false);
  });
});
