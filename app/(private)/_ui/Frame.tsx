// The workspace frame (D71, brand proposal): the burgundy header with the workspace name, the "?" that
// opens the first-use cards (issue 312) and EN · PT · FR, the page, and, once signed in, the five
// destinations: bottom tabs below 768, the side rail from 768 and the labelled sidebar with each
// destination's views from 1280 (AppShell, D122). Designed at 360 px; every control is 44 px or more.
// Pages keep the 960 px width until each is laid out for the wider widths (D122 rollout).
import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";

import { ALLIANCES } from "@/config/alliances";
import { analyticsPerson } from "@/lib/analytics/person";
import { AppShell } from "@/lib/brand/components/layout/AppShell";
import { fill, isolate } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import type { WorkspaceAccess } from "@/lib/private/access";
import { WORKSPACE_INTRO_COOKIE, WORKSPACE_LANG_COOKIE } from "@/lib/private/cookies";
import {
  pickWorkspaceLanguage,
  WORKSPACE_DICTIONARIES,
  type WorkspaceDictionary,
  type WorkspaceLanguage,
} from "@/lib/private/dictionary";

import { AnalyticsPerson } from "./AnalyticsPerson";
import { type DeskView, SideNav, Tabs, VIEW_TAB } from "./DeskNav";
import { FirstUse } from "./FirstUse";
import { LanguageSwitch } from "./LanguageSwitch";
import { ProfileSheet } from "./ProfileSheet";
import { SignedOutProvider } from "./SignedOut";
import { SignOutButton } from "./SignOutButton";
import type { TabId } from "./TabIcon";

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

export async function Frame({
  language,
  t,
  title,
  subtitle,
  account,
  tabs,
  children,
}: {
  language: WorkspaceLanguage;
  t: WorkspaceDictionary;
  /** The name in the header; the Officers' Desk unless given (the members' board, D105). */
  title?: string;
  /** The alliance, under the workspace name. */
  subtitle?: string;
  /** "Signed in as … · Sign out", once signed in. */
  account?: ReactNode;
  /** Signed in: the destinations with `current` open (and `view` inside it), and the first-use cards. */
  tabs?: { slug: string; current: TabId; view?: DeskView; waiting: number };
  children: ReactNode;
}) {
  const seen = !tabs || (await cookies()).get(WORKSPACE_INTRO_COOKIE)?.value === "1";
  const bar = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-display text-display-sm">{title ?? t["app.name"]}</p>
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
  );
  return (
    <AppShell
      lang={language}
      barClass="bg-burgundy text-wax-paper"
      bar={bar}
      legacyWidth
      {...(tabs && {
        tabs: <Tabs t={t} slug={tabs.slug} current={tabs.current} waiting={tabs.waiting} />,
        rail: <SideNav t={t} {...tabs} wide={false} />,
        sidebar: <SideNav t={t} {...tabs} wide />,
      })}
    >
      {children}
    </AppShell>
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
  current: at,
  waiting,
  children,
}: {
  access: WorkspaceAccess;
  language: WorkspaceLanguage;
  t: WorkspaceDictionary;
  /** The open destination, or one of its views (its destination is open, and the view marked). */
  current: TabId | DeskView;
  waiting: number;
  children: ReactNode;
}) {
  const view = at in VIEW_TAB ? (at as DeskView) : undefined;
  const current = view ? VIEW_TAB[view] : (at as TabId);
  const alliance = ALLIANCES.find((a) => a.unionId === access.unionId);
  const name = access.user.displayName ?? "";
  const person = analyticsPerson(getEnv(), {
    userId: access.user.id,
    tier: "officer",
    workspace: access.slug,
  });
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
        tabs={{ slug: access.slug, current, waiting, ...(view && { view }) }}
        account={account}
        {...(alliance && { subtitle: `${alliance.tag} · ${alliance.name}` })}
      >
        {person && <AnalyticsPerson {...person} />}
        {children}
      </Frame>
    </SignedOutProvider>
  );
}
