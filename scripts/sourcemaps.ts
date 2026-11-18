// After `next build` (D115): uploads the browser source maps to PostHog's error tracking, so a stack frame
// points at our file, line and function, then makes sure no map is left to be served.
// - POSTHOG_PERSONAL_API_KEY set (Vercel, Sensitive): `posthog-cli sourcemap process` injects the chunk ids
//   into .next/static, uploads the maps and deletes them (`--delete-after`). A failed upload is logged and
//   does not fail the build: the site ships, its stacks stay minified.
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

export type Runner = (args: string[], env: Record<string, string>) => number;

const cli: Runner = (args, env) =>
  spawnSync("posthog-cli", args, { stdio: "inherit", env: { ...process.env, ...env } }).status ?? 1;

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
      {
        POSTHOG_CLI_API_KEY: key,
        POSTHOG_CLI_PROJECT_ID: POSTHOG_PROJECT_ID,
        POSTHOG_CLI_HOST: POSTHOG_APP_HOST,
      },
    );
    said = status === 0 ? "source maps: uploaded" : `source maps: upload failed (exit ${status})`;
  }
  return `${said}; ${deleteMaps(dir)} left-over map files deleted`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(finishSourceMaps(process.env));
}
