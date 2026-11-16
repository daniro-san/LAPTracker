// /w/[slug]/how-to (issue 312): the one page the leadership pins in its Discord, in the reader's language
// (the EN · PT · FR switch, else the phone's): the address, signing in with Discord, and adding it to the
// home screen on iPhone and Android. It reads nothing, so it opens before anyone signs in.
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { buttonClass } from "@/lib/brand/components/Button";
import { SLUG } from "@/lib/private/sign-in";

import { Frame, workspaceWords } from "../../../_ui/Frame";

const STEPS = [
  ["howto.signin", "howto.signin.body"],
  ["howto.iphone", "howto.iphone.body"],
  ["howto.android", "howto.android.body"],
] as const;

export default async function HowToPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const head = await headers();
  const proto = head.get("x-forwarded-proto") ?? "https";
  const address = `${proto}://${head.get("host") ?? ""}/w/${slug}`;
  const { language, t } = await workspaceWords();
  return (
    <Frame language={language} t={t}>
      <article aria-labelledby="how-to" className="mx-auto max-w-md">
        <h1 id="how-to" className="font-display text-display-lg">
          {t["howto.title"]}
        </h1>
        <p className="mt-3">{t["howto.lead"]}</p>
        <h2 className="mt-6 font-subhead text-display-sm">{t["howto.address"]}</h2>
        <p className="mt-2 border border-rule px-3 py-2 font-semibold break-all" translate="no">
          {address}
        </p>
        {STEPS.map(([title, body]) => (
          <section key={title}>
            <h2 className="mt-6 font-subhead text-display-sm">{t[title]}</h2>
            <p className="mt-2">{t[body]}</p>
          </section>
        ))}
        <p className="mt-6">{t["howto.after"]}</p>
        <a href={`/w/${slug}`} className={buttonClass("primary", "mt-6 w-full text-lg")}>
          {t["howto.open"]}
        </a>
      </article>
    </Frame>
  );
}
