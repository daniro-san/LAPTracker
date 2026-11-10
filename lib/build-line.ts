// The footer's build line (D58): which build is live. next.config.ts calls buildInfo once per build with
// Vercel's system variables and the build's clock, and inlines both values with `env`. BUILD_LABEL is the
// release on a main deploy of a release merge commit, else the branch, then the short commit; BUILD_AT
// is the build time (ISO, empty locally), which the footer formats with the request's clock like every
// other date.
// The line release-publish.yml matches (D29): on any line, so GitHub's default merge message works too.
const RELEASE = /^release: (v\d+\.\d+\.\d+)/m;

// Reads VERCEL_GIT_COMMIT_SHA, VERCEL_GIT_COMMIT_REF and VERCEL_GIT_COMMIT_MESSAGE.
export function buildInfo(
  env: Record<string, string | undefined>,
  builtAt: Date,
): { BUILD_LABEL: string; BUILD_AT: string } {
  const sha = env.VERCEL_GIT_COMMIT_SHA;
  if (!sha) return { BUILD_LABEL: "local", BUILD_AT: "" };
  const ref = env.VERCEL_GIT_COMMIT_REF;
  const release =
    ref === "main" ? RELEASE.exec(env.VERCEL_GIT_COMMIT_MESSAGE ?? "")?.[1] : undefined;
  return { BUILD_LABEL: `${release ?? ref} · ${sha.slice(0, 7)}`, BUILD_AT: builtAt.toISOString() };
}
