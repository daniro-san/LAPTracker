// /w/[slug]: the access check first, then either the sign-in, or the signed-in shell with Home. A session
// older than 24 hours goes through Discord again without a click (prompt=none, D71).
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { ALLIANCES } from "@/config/alliances";
import { buttonClass } from "@/lib/brand/components/Button";
import { fill } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import { requireWorkspace } from "@/lib/private/access";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { SLUG } from "@/lib/private/sign-in";

import { Frame, workspaceWords } from "../../_ui/Frame";
import { SignOutButton } from "../../_ui/SignOutButton";

const ERRORS = ["denied", "discord", "not_configured"] as const;
type SignInError = (typeof ERRORS)[number];

function SignIn({ slug, t, error }: { slug: string; t: WorkspaceDictionary; error?: SignInError }) {
  return (
    <section aria-labelledby="sign-in" className="mx-auto max-w-md">
      <h1 id="sign-in" className="font-display text-display-lg">
        {t["signin.title"]}
      </h1>
      <p className="mt-3">{t["signin.lead"]}</p>
      {error && (
        <p role="alert" className="mt-4 border-l-4 border-seal pl-3 text-body-sm">
          {t[`signin.e.${error}`]}
        </p>
      )}
      <a href={`/api/w/${slug}/login`} className={buttonClass("primary", "mt-6 w-full text-lg")}>
        {t["signin.button"]}
      </a>
      <p className="mt-4 text-body-sm text-ink/75">{t["signin.note"]}</p>
    </section>
  );
}

function Home({ t }: { t: WorkspaceDictionary }) {
  return (
    <section aria-labelledby="home">
      <h1 id="home" className="font-display text-display-lg">
        {t["home.title"]}
      </h1>
      <div className="mt-4 border border-rule px-4 py-5">
        <p className="font-subhead text-display-sm">{t["home.empty"]}</p>
        <p className="mt-2 text-ink/80">{t["home.next"]}</p>
      </div>
    </section>
  );
}

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const jar = await cookies();
  // INVARIANT workspace.access-first: nothing private is read before this check.
  const access = await withPageDb((db) => requireWorkspace(db, slug, jar, new Date()));
  if (!access.ok && access.reason === "no_workspace") notFound();
  if (!access.ok && access.reason === "expired") redirect(`/api/w/${slug}/login?silent=1`);
  if (!access.ok && access.reason === "blocked") redirect(`/w/${slug}/no-access?why=blocked`);
  const { language, t } = await workspaceWords();
  if (!access.ok) {
    const e = (await searchParams).e;
    const error = ERRORS.find((code) => code === e);
    return (
      <Frame language={language} t={t}>
        <SignIn slug={slug} t={t} {...(error && { error })} />
      </Frame>
    );
  }
  const alliance = ALLIANCES.find((a) => a.unionId === access.unionId);
  const account = (
    <>
      <span className="min-w-0 truncate">
        {fill(t["shell.signedIn"], { name: access.user.displayName ?? "" })}
      </span>
      <SignOutButton slug={slug} label={t["shell.signOut"]} />
    </>
  );
  return (
    <Frame
      language={language}
      t={t}
      tabs
      account={account}
      {...(alliance && { subtitle: `${alliance.tag} · ${alliance.name}` })}
    >
      <Home t={t} />
    </Frame>
  );
}
