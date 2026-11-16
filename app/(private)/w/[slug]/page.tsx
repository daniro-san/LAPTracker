// /w/[slug]: the access check first, then either the sign-in, or the signed-in shell with Home. A session
// older than 24 hours goes through Discord again without a click (prompt=none, D71).
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { buttonClass } from "@/lib/brand/components/Button";
import { withPageDb } from "@/lib/page";
import { requireWorkspace } from "@/lib/private/access";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { SLUG } from "@/lib/private/sign-in";

import { Frame, SignedInFrame, workspaceWords } from "../../_ui/Frame";
import { refuse } from "../../_ui/refuse";

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
      <p className="mt-2">
        <a
          href={`/w/${slug}/how-to`}
          className="inline-flex min-h-11 items-center py-2 font-semibold underline underline-offset-4"
        >
          {t["signin.howto"]}
        </a>
      </p>
    </section>
  );
}

function Home({ slug, t }: { slug: string; t: WorkspaceDictionary }) {
  return (
    <section aria-labelledby="home">
      <h1 id="home" className="font-display text-display-lg">
        {t["home.title"]}
      </h1>
      <div className="mt-4 border border-rule px-4 py-5">
        <p className="font-subhead text-display-sm">{t["home.empty"]}</p>
        <p className="mt-2 text-ink/80">{t["home.next"]}</p>
        <a href={`/w/${slug}/members`} className={buttonClass("secondary", "mt-4")}>
          {t["home.open"]}
        </a>
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
  if (!access.ok) refuse(slug, access.reason);
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
  return (
    <SignedInFrame access={access} language={language} t={t} current="home">
      <Home slug={slug} t={t} />
    </SignedInFrame>
  );
}
