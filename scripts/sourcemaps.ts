// After `next build` (D115): uploads the browser's and the server's source maps to PostHog's error tracking,
// so a stack frame points at our file, line and function, then makes sure no map is left in the deployment.
// - POSTHOG_PERSONAL_API_KEY set (Vercel, Sensitive): `posthog-cli sourcemap process` runs once per directory
//   of MAP_DIRS. It injects each chunk's id (the browser SDK, and lib/analytics/server.ts `stackFrames` for
//   the server, read it back from `globalThis._posthogChunkIds`), uploads the maps and deletes them
//   (`--delete-after`). A failed upload, or one that takes over UPLOAD_TIMEOUT_MS (so up to 2 × 120 s per
//   build), is logged and does not fail the build: that directory's chunks are put back as Next built them,
//   the site ships, those stacks stay minified. The CLI gets only PATH, HOME and the POSTHOG_CLI_* variables.
// - Not set (local builds, CI, previews without it): nothing is sent. No browser map was built
//   (next.config.ts); Turbopack writes the server's maps anyway.
// Either way every *.map left under MAP_DIRS is deleted. The key goes to the CLI's environment only; it is
// never printed.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** LAPTracker's PostHog project (D77), and the region's app host (lib/analytics/region.ts). */
export const POSTHOG_PROJECT_ID = "741657";
const POSTHOG_APP_HOST = "https://us.posthog.com";
export const STATIC_DIR = ".next/static";
/** The server's chunks: Turbopack writes a map beside each (1,053 maps in a local build, 2026-11-21). */
export const SERVER_DIR = ".next/server";
/** Uploaded, then emptied of maps, in this order. */
export const MAP_DIRS = [STATIC_DIR, SERVER_DIR];

/** Each directory's upload may take this long; past it the CLI is stopped and the build goes on without it. */
export const UPLOAD_TIMEOUT_MS = 120_000;

/** Runs the CLI with exactly `env` (nothing else of the build's environment); its exit code, or "timeout". */
export type Runner = (args: string[], env: Record<string, string>) => number | "timeout";

const cli: Runner = (args, env) => {
  const done = spawnSync("posthog-cli", args, {
    stdio: "inherit",
    // Exactly these variables; Next's types make NODE_ENV required on ProcessEnv, which the CLI needs not.
    env: env as NodeJS.ProcessEnv,
    timeout: UPLOAD_TIMEOUT_MS,
  });
  if ((done.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT") return "timeout";
  return done.status ?? 1;
};

/**
 * What the CLI sees: PATH and HOME to start, its own POSTHOG_CLI_* settings, and the key, project and host.
 * Never the database URL, the other secrets or anything else the build has.
 */
function cliEnv(env: Record<string, string | undefined>, key: string): Record<string, string> {
  const passed = Object.entries(env).filter(
    (e): e is [string, string] =>
      e[1] !== undefined && (e[0] === "PATH" || e[0] === "HOME" || e[0].startsWith("POSTHOG_CLI_")),
  );
  return {
    ...Object.fromEntries(passed),
    POSTHOG_CLI_API_KEY: key,
    POSTHOG_CLI_PROJECT_ID: POSTHOG_PROJECT_ID,
    POSTHOG_CLI_HOST: POSTHOG_APP_HOST,
  };
}

/** Every *.map under `dir`, deleted; returns how many. */
function deleteMaps(dir: string): number {
  let deleted = 0;
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".map")) {
      rmSync(join(entry.parentPath, entry.name));
      deleted += 1;
    }
  }
  return deleted;
}

/**
 * The chunks the CLI rewrites (each *.js with a *.js.map beside it), copied aside first. The CLI writes them in
 * place, so one stopped mid-write would ship cut short: `restore` puts every one back as Next built it.
 */
function keepChunks(dir: string): { restore: () => void; drop: () => void } {
  const aside = mkdtempSync(join(tmpdir(), "lap-chunks-"));
  const drop = () => rmSync(aside, { recursive: true, force: true });
  const chunks = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".js.map"))
    .map((e) => join(e.parentPath, e.name.slice(0, -".map".length)))
    .filter((chunk) => existsSync(chunk));
  try {
    chunks.forEach((chunk, i) => copyFileSync(chunk, join(aside, String(i))));
  } catch (error) {
    drop();
    throw error;
  }
  return {
    restore: () => chunks.forEach((chunk, i) => copyFileSync(join(aside, String(i)), chunk)),
    drop,
  };
}

/**
 * One directory's upload, as the build line says it. A run that did not finish (a failure or the timeout)
 * leaves the chunks as Next built them, without chunk ids: their frames stay minified, never broken. When
 * the chunks cannot be copied aside (a full or read-only temp folder), the CLI is not run for that directory:
 * an upload problem never fails the build. A restore that fails does: the chunks may be cut short.
 */
function upload(env: Record<string, string | undefined>, key: string, dir: string, run: Runner) {
  const version = env.VERCEL_GIT_COMMIT_SHA;
  let kept: ReturnType<typeof keepChunks>;
  try {
    kept = keepChunks(dir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "error";
    return `${dir} not uploaded (its chunks could not be copied aside: ${code})`;
  }
  const status = run(
    [
      "sourcemap",
      "process",
      "--directory",
      dir,
      "--delete-after",
      "--release-name",
      "laptracker",
      ...(version ? ["--release-version", version] : []),
    ],
    cliEnv(env, key),
  );
  if (status !== 0) kept.restore();
  kept.drop();
  return status === 0
    ? `${dir} uploaded`
    : status === "timeout"
      ? `${dir} upload stopped after ${UPLOAD_TIMEOUT_MS / 1000} s`
      : `${dir} upload failed (exit ${status})`;
}

/** What `pnpm build` runs after Next; returns a line for the build log, without the key. */
export function finishSourceMaps(
  env: Record<string, string | undefined>,
  dirs: readonly string[] = MAP_DIRS,
  run: Runner = cli,
): string {
  const key = env.POSTHOG_PERSONAL_API_KEY;
  const said = key
    ? dirs.map((dir) => upload(env, key, dir, run)).join(", ")
    : "no POSTHOG_PERSONAL_API_KEY, nothing uploaded";
  const deleted = dirs.reduce((n, dir) => n + deleteMaps(dir), 0);
  return `source maps: ${said}; ${deleted} left-over map files deleted`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(finishSourceMaps(process.env));
}
