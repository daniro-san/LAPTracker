// /w/[slug]/no-access?why=… — where a refused sign-in lands (D71): why, in plain words, and what to do.
// It reads nothing: the reason comes from the callback's redirect.
import { notFound } from "next/navigation";

import { buttonClass } from "@/lib/brand/components/Button";
import { TextLink } from "@/lib/brand/components/TextLink";
import type { NoAccess } from "@/lib/private/sign-in";
import { SLUG } from "@/lib/private/sign-in";

import { Frame, workspaceWords } from "../../../_ui/Frame";

const REASONS: NoAccess[] = [
  "not_member",
  "no_role",
  "board_closed",
  "allowlist_expired",
  "blocked",
];

export default async function NoAccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const why = (await searchParams).why;
  const reason = REASONS.find((r) => r === why) ?? "no_role";
  const { language, t } = await workspaceWords();
  return (
    <Frame language={language} t={t}>
      <section aria-labelledby="no-access" className="mx-auto max-w-md">
        <h1 id="no-access" className="font-display text-display-lg">
          {t["noaccess.title"]}
        </h1>
        <p className="mt-3">{t[`noaccess.${reason}`]}</p>
        {reason !== "blocked" && (
          <a href={`/api/w/${slug}/login`} className={buttonClass("secondary", "mt-6 w-full")}>
            {t["noaccess.retry"]}
          </a>
        )}
        <p className="mt-4">
          <TextLink href="/" className="inline-flex min-h-11 items-center">
            {t["noaccess.public"]}
          </TextLink>
        </p>
      </section>
    </Frame>
  );
}
