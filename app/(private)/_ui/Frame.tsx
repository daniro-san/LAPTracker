// The workspace frame (D71, brand proposal): the burgundy header with the workspace name and EN · PT · FR,
// the page, and, once signed in, the five bottom tabs. Designed at 360 px; every control is 44 px or more.
import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";

import {
  pickWorkspaceLanguage,
  WORKSPACE_DICTIONARIES,
  WORKSPACE_LANG_COOKIE,
  type WorkspaceDictionary,
  type WorkspaceLanguage,
} from "@/lib/private/dictionary";

import { LanguageSwitch } from "./LanguageSwitch";
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

/** Only Home exists yet (issue 295); the other four come with their own issues and are shown as "soon". */
function Tabs({ t }: { t: WorkspaceDictionary }) {
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
          return (
            <li key={id}>
              {id === "home" ? (
                <a
                  href="#top"
                  aria-current="page"
                  className={`${box} border-t-[3px] border-plum font-semibold text-plum`}
                >
                  {inside}
                </a>
              ) : (
                <span
                  aria-disabled="true"
                  aria-label={`${label} (${t["tab.soon"]})`}
                  className={`${box} border-t-[3px] border-transparent text-ink/55`}
                >
                  {inside}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Frame({
  language,
  t,
  subtitle,
  account,
  tabs = false,
  children,
}: {
  language: WorkspaceLanguage;
  t: WorkspaceDictionary;
  /** The alliance, under the workspace name. */
  subtitle?: string;
  /** "Signed in as … · Sign out", once signed in. */
  account?: ReactNode;
  tabs?: boolean;
  children: ReactNode;
}) {
  return (
    <div lang={language} id="top" className={tabs ? "pb-20" : undefined}>
      <header className="bg-burgundy text-wax-paper">
        <div className="mx-auto flex max-w-[960px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="font-display text-display-sm">{t["app.name"]}</p>
            {subtitle && <p className="text-body-sm opacity-90">{subtitle}</p>}
          </div>
          <LanguageSwitch current={language} label={t["lang.aria"]} />
          {account && (
            <div className="flex basis-full flex-wrap items-center justify-between gap-x-2 border-t border-wax-paper/25 pt-1 text-body-sm">
              {account}
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-[960px] px-4 py-5 sm:px-6">{children}</main>
      {tabs && <Tabs t={t} />}
    </div>
  );
}
