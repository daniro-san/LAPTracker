// /w/[slug]/how-to (issue 312): the one page the leadership pins in its Discord, in the reader's language
// (the EN · PT · FR switch, else the phone's): open the address, sign in with Discord, add it to the home
// screen on iPhone and on Android. It reads nothing, so it opens before anyone signs in. The address is
// built from the request's own host and protocol, as the sign-in builds Discord's redirect address.
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { buttonClass } from "@/lib/brand/components/Button";
import { SLUG } from "@/lib/private/sign-in";

import { CopyButton } from "../../../_ui/CopyButton";
import { Frame, workspaceWords } from "../../../_ui/Frame";

// Alphabetical, names only, not a ranking (issue 783). Re-check the list whenever the guide is updated.
const COMMUNITY_SITES = [
  "last-asylum-unofficial.com",
  "lastasylum.gg",
  "lastasylumbuilder.com",
  "lastasylumplague.com",
  "wiki-last-asylum.com",
];

export default async function HowToPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const head = await headers();
  const proto = head.get("x-forwarded-proto") ?? "https";
  const address = `${proto}://${head.get("host") ?? ""}/w/${slug}`;
  const { language, t } = await workspaceWords(slug);
  const h2 = "mt-6 font-subhead text-display-sm";
  return (
    <Frame language={language} t={t}>
      <article aria-labelledby="how-to" className="mx-auto max-w-md">
        <h1 id="how-to" className="font-display text-display-lg">
          {t["howto.title"]}
        </h1>
        <p className="mt-3">{t["howto.lead"]}</p>
        <h2 className={h2}>{t["howto.address"]}</h2>
        <p className="mt-2 border border-rule px-3 py-2">
          <a
            href={`/w/${slug}`}
            translate="no"
            className="inline-flex min-h-11 items-center py-2 font-semibold break-all underline underline-offset-4"
          >
            {address}
          </a>
        </p>
        <div className="mt-2">
          <CopyButton
            text={address}
            labels={{
              copy: t["howto.copy"],
              copied: t["howto.copied"],
              failed: t["howto.copyFailed"],
            }}
          />
        </div>
        <p className="mt-2">{t["howto.where"]}</p>
        <h2 className={h2}>{t["howto.signin"]}</h2>
        <p className="mt-2">{t["howto.signin.body"]}</p>
        <p className="mt-2 font-semibold">{t["howto.help"]}</p>
        <h2 className={h2}>{t["howto.home"]}</h2>
        <h3 className="mt-3 font-semibold">{t["howto.iphone"]}</h3>
        <p className="mt-1">{t["howto.iphone.body"]}</p>
        <h3 className="mt-3 font-semibold">{t["howto.android"]}</h3>
        <p className="mt-1">{t["howto.android.body"]}</p>
        <p className="mt-3">{t["howto.share"]}</p>
        <p className="mt-6">{t["howto.after"]}</p>
        <h2 className={h2}>{t["howto.tools"]}</h2>
        <p className="mt-2">{t["howto.tools.body"]}</p>
        <ul className="mt-2">
          {COMMUNITY_SITES.map((site) => (
            <li key={site}>
              <a
                href={`https://${site}/`}
                target="_blank"
                rel="noopener noreferrer"
                translate="no"
                className="inline-flex min-h-11 items-center py-2 font-semibold break-all underline underline-offset-4"
              >
                {site}
              </a>
            </li>
          ))}
        </ul>
        <a href={`/w/${slug}`} className={buttonClass("primary", "mt-6 w-full text-lg")}>
          {t["howto.open"]}
        </a>
      </article>
    </Frame>
  );
}
