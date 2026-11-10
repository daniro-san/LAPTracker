// The live version in the footer (D59). next.config.ts calls this once per build with Vercel's system
// variables and inlines the result as process.env.BUILD_VERSION: the release on a main deploy of a release
// merge commit, else the branch (`dev`), and `local` outside Vercel.
// The line release-publish.yml matches (D29): on any line, so GitHub's default merge message works too.
const RELEASE = /^release: (v\d+\.\d+\.\d+)/m;

// Reads VERCEL_GIT_COMMIT_REF and VERCEL_GIT_COMMIT_MESSAGE.
export function buildVersion(env: Record<string, string | undefined>): string {
  const ref = env.VERCEL_GIT_COMMIT_REF;
  if (!ref) return "local";
  const release =
    ref === "main" ? RELEASE.exec(env.VERCEL_GIT_COMMIT_MESSAGE ?? "")?.[1] : undefined;
  return release ?? ref;
}
