// After `next build` (D115): uploads the browser source maps to PostHog's error tracking, so a stack frame
// points at our file, line and function, then makes sure no map is left to be served.
// - POSTHOG_PERSONAL_API_KEY set (Vercel, Sensitive): `posthog-cli sourcemap process` injects the chunk ids
//   into .next/static, uploads the maps and deletes them (`--delete-after`). A failed upload, or one that
//   takes over UPLOAD_TIMEOUT_MS, is logged and does not fail the build: the site ships, its stacks stay
//   minified. The CLI gets only PATH, HOME and the POSTHOG_CLI_* variables.
// - Not set (local builds, CI, previews without it): no map was built (next.config.ts), nothing is sent.
// Either way every *.map left under .next/static is deleted. The key goes to the CLI's environment only; it
// is never printed.
import { spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** LAPTracker's PostHog project (D77), and the region's app host (lib/analytics/region.ts). */
export const POSTHOG_PROJECT_ID = "741657";
const POSTHOG_APP_HOST = "https://us.posthog.com";
export const STATIC_DIR = ".next/static";

/** The upload may take this long; past it the CLI is stopped and the build goes on without it. */
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

/** What `pnpm build` runs after Next; returns a line for the build log, without the key. */
export function finishSourceMaps(
  env: Record<string, string | undefined>,
  dir = STATIC_DIR,
  run: Runner = cli,
): string {
  const key = env.POSTHOG_PERSONAL_API_KEY;
  let said = "source maps: no POSTHOG_PERSONAL_API_KEY, nothing uploaded";
  if (key) {
    const version = env.VERCEL_GIT_COMMIT_SHA;
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
    said =
      status === 0
        ? "source maps: uploaded"
        : status === "timeout"
          ? `source maps: upload stopped after ${UPLOAD_TIMEOUT_MS / 1000} s`
          : `source maps: upload failed (exit ${status})`;
  }
  return `${said}; ${deleteMaps(dir)} left-over map files deleted`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(finishSourceMaps(process.env));
}
