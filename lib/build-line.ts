// The footer's build line (D58): which build is live. next.config.ts calls this once per build with
// Vercel's system variables and the build's clock, and inlines the result as process.env.BUILD_LINE.
// A main deploy of a release merge commit shows the release; any other deploy shows its branch.
// The line release-publish.yml matches (D29): on any line, so GitHub's default merge message works too.
const RELEASE = /^release: (v\d+\.\d+\.\d+)/m;

// Reads VERCEL_GIT_COMMIT_SHA, VERCEL_GIT_COMMIT_REF and VERCEL_GIT_COMMIT_MESSAGE.
export function buildLine(env: Record<string, string | undefined>, builtAt: Date): string {
  const sha = env.VERCEL_GIT_COMMIT_SHA;
  if (!sha) return "local";
  const ref = env.VERCEL_GIT_COMMIT_REF;
  const release =
    ref === "main" ? RELEASE.exec(env.VERCEL_GIT_COMMIT_MESSAGE ?? "")?.[1] : undefined;
  return [release ?? ref, sha.slice(0, 7), builtAt.toISOString().slice(0, 10)].join(" · ");
}
