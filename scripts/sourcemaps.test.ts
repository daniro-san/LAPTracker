// The build's source-map step (D115), with a stand-in for posthog-cli: nothing is sent to PostHog.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { finishSourceMaps, MAP_DIRS, POSTHOG_PROJECT_ID, type Runner } from "./sourcemaps";

let root = "";
const home = process.cwd();

/**
 * A project after `next build`, as the build's working directory: the browser's .next/static/chunks and the
 * server's .next/server/chunks/ssr, a chunk and its map in each, and a server manifest with no map.
 * Returns the directories the step reads by default.
 */
function built(): readonly string[] {
  root = mkdtempSync(join(tmpdir(), "maps-"));
  for (const chunks of [".next/static/chunks", ".next/server/chunks/ssr"]) {
    mkdirSync(join(root, chunks), { recursive: true });
    writeFileSync(join(root, chunks, "a.js"), "x");
    writeFileSync(join(root, chunks, "a.js.map"), "{}");
  }
  writeFileSync(join(root, ".next/server/pages-manifest.json"), "{}");
  process.chdir(root);
  return MAP_DIRS;
}
const left = (chunks: string) => existsSync(join(root, ".next", chunks, "a.js.map"));

afterEach(() => {
  process.chdir(home);
  rmSync(root, { recursive: true, force: true });
});

describe("finishSourceMaps (D115)", () => {
  it("uploads the server's maps after the browser's, then leaves no map in .next/server", () => {
    const run = vi.fn<Runner>(() => 0);
    built();
    const said = finishSourceMaps({ POSTHOG_PERSONAL_API_KEY: "phx_test" }, undefined, run);
    expect(run.mock.calls.map(([args]) => args[args.indexOf("--directory") + 1])).toEqual([
      ".next/static",
      ".next/server",
    ]);
    expect(said).toBe(
      "source maps: .next/static uploaded, .next/server uploaded; 2 left-over map files deleted",
    );
    expect(left("server/chunks/ssr")).toBe(false);
    expect(existsSync(join(root, ".next/server/chunks/ssr/a.js"))).toBe(true);
  });

  it("without the personal key: runs no upload, the build goes on, and no map is left in either directory", () => {
    const run = vi.fn<Runner>(() => 0);
    const said = finishSourceMaps({}, built(), run);
    expect(run).not.toHaveBeenCalled();
    expect(said).toBe(
      "source maps: no POSTHOG_PERSONAL_API_KEY, nothing uploaded; 2 left-over map files deleted",
    );
    expect(left("static/chunks")).toBe(false);
    expect(left("server/chunks/ssr")).toBe(false);
    expect(existsSync(join(root, ".next/server/chunks/ssr/a.js"))).toBe(true);
    expect(existsSync(join(root, ".next/server/pages-manifest.json"))).toBe(true);
  });

  it("with the key: hands it to the CLI's environment only, and deletes the maps even when the upload fails", () => {
    const run = vi.fn<Runner>(() => 1);
    const dirs = built();
    const said = finishSourceMaps(
      { POSTHOG_PERSONAL_API_KEY: "phx_test", VERCEL_GIT_COMMIT_SHA: "abc123" },
      dirs,
      run,
    );
    const [args, env] = run.mock.calls[1] ?? [[], {}];
    expect(args).toEqual([
      "sourcemap",
      "process",
      "--directory",
      dirs[1],
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
    expect(said).toBe(
      `source maps: ${dirs[0]} upload failed (exit 1), ${dirs[1]} upload failed (exit 1); 2 left-over map files deleted`,
    );
    expect(said).not.toContain("phx_test");
    expect(left("static/chunks")).toBe(false);
    expect(left("server/chunks/ssr")).toBe(false);
  });

  it("gives the CLI only PATH, HOME and POSTHOG_CLI_*: never the database URL or other secrets", () => {
    const run = vi.fn<Runner>(() => 0);
    finishSourceMaps(
      {
        POSTHOG_PERSONAL_API_KEY: "phx_test",
        PATH: "/usr/bin",
        HOME: "/home/build",
        POSTHOG_CLI_DRY_RUN: "true",
        DATABASE_URL: "postgres://lap:secret@db.example/lap",
        CRON_SECRET: "c".repeat(32),
      },
      built(),
      run,
    );
    for (const [, env] of run.mock.calls) {
      expect(env).not.toHaveProperty("DATABASE_URL");
      expect(env).not.toHaveProperty("CRON_SECRET");
      expect(env).not.toHaveProperty("POSTHOG_PERSONAL_API_KEY");
      expect(Object.keys(env).sort()).toEqual([
        "HOME",
        "PATH",
        "POSTHOG_CLI_API_KEY",
        "POSTHOG_CLI_DRY_RUN",
        "POSTHOG_CLI_HOST",
        "POSTHOG_CLI_PROJECT_ID",
      ]);
    }
  });

  it("does not fail the build when the server's upload times out, and still deletes its maps", () => {
    const dirs = built();
    const said = finishSourceMaps({ POSTHOG_PERSONAL_API_KEY: "phx_test" }, dirs, (args) =>
      args.includes(dirs[1] ?? "") ? "timeout" : 0,
    );
    expect(said).toBe(
      `source maps: ${dirs[0]} uploaded, ${dirs[1]} upload stopped after 120 s; 2 left-over map files deleted`,
    );
    expect(left("server/chunks/ssr")).toBe(false);
  });

  it("never ships a chunk the CLI was stopped while rewriting; a finished run keeps its chunk ids", () => {
    const dirs = built();
    const chunk = (dir: string) => join(root, ".next", dir, "a.js");
    writeFileSync(chunk("static/chunks"), "self.TURBOPACK.push([1, () => {}]);");
    writeFileSync(chunk("server/chunks/ssr"), 'module.exports=[1,a=>{"use strict";a.s([])}];');
    // The stand-in rewrites each chunk as the CLI does; the server's run is stopped half-way.
    const said = finishSourceMaps({ POSTHOG_PERSONAL_API_KEY: "phx_test" }, dirs, (args) => {
      const server = args.includes(".next/server");
      const file = chunk(server ? "server/chunks/ssr" : "static/chunks");
      writeFileSync(file, server ? '!function(){try{var e="undef' : "/*id*/ injected");
      return server ? "timeout" : 0;
    });
    expect(said).toContain(".next/server upload stopped after 120 s");
    expect(readFileSync(chunk("server/chunks/ssr"), "utf8")).toBe(
      'module.exports=[1,a=>{"use strict";a.s([])}];',
    );
    expect(readFileSync(chunk("static/chunks"), "utf8")).toBe("/*id*/ injected");
  });
});
