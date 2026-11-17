// The workspace frame (D71, brand proposal): the burgundy header with the workspace name, the "?" that
// opens the first-use cards (issue 312) and EN · PT · FR, the page, and, once signed in, the five bottom
// tabs. Designed at 360 px; every control is 44 px or more.
import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";

import { ALLIANCES } from "@/config/alliances";
import { fill, isolate } from "@/lib/copy";
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
import { SignedOutProvider } from "./SignedOut";
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
/** The tabs that exist so far; the others come with their own issues and are shown as "soon". Notices
 * live inside Calendar (its Week · Caravans · Notices views, prototype v5), so it has no tab of its own. */
const PATHS: Partial<Record<TabId, string>> = { home: "", members: "/members", days: "/calendar" };

/** The Home tab's count of screenshot drafts waiting for review (issue 299), beside its label. */
function Waiting({ n, t }: { n: number; t: WorkspaceDictionary }) {
  if (n === 0) return null;
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute top-1 left-1/2 ml-2 rounded-full bg-seal px-1.5 text-[11px] leading-4 font-semibold text-paper tabular-nums"
      >
        {n}
      </span>
      <span className="sr-only">{`, ${fill(t["shots.badge"], { n })}`}</span>
    </>
  );
}

function Tabs({
  t,
  slug,
  current,
  waiting,
}: {
  t: WorkspaceDictionary;
  slug: string;
  current: TabId;
  waiting: number;
}) {
  return (
    // Hidden while a notice editor is open, so its save bar is never under the tabs (review of PR 344).
    <nav
      aria-label={t["tab.aria"]}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-rule bg-paper pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] [:root:has(form[data-notice-editor])_&]:hidden"
    >
      <ul className="mx-auto grid max-w-[640px] grid-cols-5">
        {TABS.map((id) => {
          const label = t[`tab.${id}`];
          const inside = (
            <>
              <TabIcon id={id} />
              {/* Five tabs leave 72 px each at 360 px. 12 px fits the longest word ("Acompanhar") whole;
                  a label of two words may take two lines, broken only between words. */}
              <span className="max-w-full text-[12px] leading-tight hyphens-none [overflow-wrap:normal]">
                {label}
              </span>
              {id === "home" && <Waiting n={waiting} t={t} />}
            </>
          );
          const box =
            "relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 text-center";
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
  tabs?: { slug: string; current: TabId; waiting: number };
  children: ReactNode;
}) {
  const seen = !tabs || (await cookies()).get(WORKSPACE_INTRO_COOKIE)?.value === "1";
  return (
    <div
      lang={language}
      id="top"
      className={tabs ? "pb-[calc(5rem+env(safe-area-inset-bottom))]" : undefined}
    >
      <header className="bg-burgundy pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] text-wax-paper">
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
      <main className="mx-auto max-w-[960px] py-5 wrap-anywhere pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]">
        {children}
      </main>
      {tabs && <Tabs t={t} {...tabs} />}
    </div>
  );
}

/**
 * The frame once signed in: the alliance under the name, "Signed in as … · Sign out", the tabs with the
 * count of screenshot drafts waiting for review on Home (`waiting`, read by the page in its own
 * database read: the frame opens no connection).
 */
export function SignedInFrame({
  access,
  language,
  t,
  current,
  waiting,
  children,
}: {
  access: WorkspaceAccess;
  language: WorkspaceLanguage;
  t: WorkspaceDictionary;
  current: TabId;
  waiting: number;
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
        label={fill(t["shell.signedIn"], { name: isolate(name) })}
      />
      <SignOutButton
        slug={access.slug}
        words={{
          label: t["shell.signOut"],
          ask: t["shell.signOutAsk"],
          stay: t["shell.stay"],
        }}
      />
    </>
  );
  return (
    <SignedOutProvider slug={access.slug} text={t["signedOut.text"]} link={t["signedOut.link"]}>
      <Frame
        language={language}
        t={t}
        tabs={{ slug: access.slug, current, waiting }}
        account={account}
        {...(alliance && { subtitle: `${alliance.tag} · ${alliance.name}` })}
      >
        {children}
      </Frame>
    </SignedOutProvider>
  );
}
