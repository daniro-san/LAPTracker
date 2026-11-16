// The workspace frame (D71, brand proposal): the burgundy header with the workspace name, the "?" that
// opens the first-use cards (issue 312) and EN · PT · FR, the page, and, once signed in, the five bottom
// tabs. Designed at 360 px; every control is 44 px or more.
import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";

import { ALLIANCES } from "@/config/alliances";
import { fill } from "@/lib/copy";
import type { WorkspaceAccess } from "@/lib/private/access";
import { WORKSPACE_INTRO_COOKIE, WORKSPACE_LANG_COOKIE } from "@/lib/private/cookies";
import {
  pickWorkspaceLanguage,
  WORKSPACE_DICTIONARIES,
  type WorkspaceDictionary,
  type WorkspaceLanguage,
} from "@/lib/private/dictionary";

import { FirstUse } from "./FirstUse";
import { LanguageSwitch } from "./LanguageSwitch";
import { ProfileSheet } from "./ProfileSheet";
import { SignOutButton } from "./SignOutButton";
import { TabIcon, type TabId } from "./TabIcon";

/** The request's workspace language and its words (the switch's cookie, else Accept-Language). */
export async function workspaceWords(): Promise<{
  language: WorkspaceLanguage;
  t: WorkspaceDictionary;
}> {
  const [jar, head] = await Promise.all([cookies(), headers()]);
  const language = pickWorkspaceLanguage(
    jar.get(WORKSPACE_LANG_COOKIE)?.value,
    head.get("accept-language"),
  );
  return { language, t: WORKSPACE_DICTIONARIES[language] };
}

const TABS: TabId[] = ["home", "members", "mark", "days", "review"];
/** The tabs that exist so far; the other three come with their own issues and are shown as "soon". */
const PATHS: Partial<Record<TabId, string>> = { home: "", members: "/members" };

function Tabs({ t, slug, current }: { t: WorkspaceDictionary; slug: string; current: TabId }) {
  return (
    <nav
      aria-label={t["tab.aria"]}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-rule bg-paper pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-[640px] grid-cols-5">
        {TABS.map((id) => {
          const label = t[`tab.${id}`];
          const inside = (
            <>
              <TabIcon id={id} />
              <span className="text-[13px] leading-tight">{label}</span>
            </>
          );
          const box = "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-center";
          const path = PATHS[id];
          return (
            <li key={id}>
              {path === undefined ? (
                <span
                  aria-disabled="true"
                  aria-label={`${label} (${t["tab.soon"]})`}
                  className={`${box} border-t-[3px] border-transparent text-ink/55`}
                >
                  {inside}
                  <span aria-hidden="true" className="text-[11px] leading-none">
                    {t["tab.soon"].toLowerCase()}
                  </span>
                </span>
              ) : (
                <a
                  href={`/w/${slug}${path}`}
                  aria-current={id === current ? "page" : undefined}
                  className={`${box} border-t-[3px] ${
                    id === current ? "border-plum font-semibold text-plum" : "border-transparent"
                  }`}
                >
                  {inside}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export async function Frame({
  language,
  t,
  subtitle,
  account,
  tabs,
  children,
}: {
  language: WorkspaceLanguage;
  t: WorkspaceDictionary;
  /** The alliance, under the workspace name. */
  subtitle?: string;
  /** "Signed in as … · Sign out", once signed in. */
  account?: ReactNode;
  /** Signed in: the bottom tabs with `current` open, and the first-use cards. */
  tabs?: { slug: string; current: TabId };
  children: ReactNode;
}) {
  const seen = !tabs || (await cookies()).get(WORKSPACE_INTRO_COOKIE)?.value === "1";
  return (
    <div lang={language} id="top" className={tabs ? "pb-20" : undefined}>
      <header className="bg-burgundy text-wax-paper">
        <div className="mx-auto flex max-w-[960px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="font-display text-display-sm">{t["app.name"]}</p>
            {subtitle && <p className="text-body-sm opacity-90">{subtitle}</p>}
          </div>
          {tabs && <FirstUse t={t} seen={seen} />}
          <LanguageSwitch current={language} label={t["lang.aria"]} />
          {account && (
            <div className="flex min-w-0 basis-full items-center justify-between gap-x-2 border-t border-wax-paper/25 pt-1 text-body-sm">
              {account}
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-[960px] px-4 py-5 sm:px-6">{children}</main>
      {tabs && <Tabs t={t} {...tabs} />}
    </div>
  );
}

/** The frame once signed in: the alliance under the name, "Signed in as … · Sign out", the tabs. */
export function SignedInFrame({
  access,
  language,
  t,
  current,
  children,
}: {
  access: WorkspaceAccess;
  language: WorkspaceLanguage;
  t: WorkspaceDictionary;
  current: TabId;
  children: ReactNode;
}) {
  const alliance = ALLIANCES.find((a) => a.unionId === access.unionId);
  const name = access.user.displayName ?? "";
  const account = (
    <>
      <ProfileSheet
        slug={access.slug}
        t={t}
        language={language}
        name={name}
        label={fill(t["shell.signedIn"], { name })}
      />
      <SignOutButton slug={access.slug} label={t["shell.signOut"]} />
    </>
  );
  return (
    <Frame
      language={language}
      t={t}
      tabs={{ slug: access.slug, current }}
      account={account}
      {...(alliance && { subtitle: `${alliance.tag} · ${alliance.name}` })}
    >
      {children}
    </Frame>
  );
}
