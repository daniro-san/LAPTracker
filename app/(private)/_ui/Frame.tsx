// The workspace frame (D71, brand proposal): the burgundy header with the workspace name, the "?" that
// opens the first-use cards (issue 312) and EN · PT · FR, the page, and, once signed in, the five
// destinations: bottom tabs below 768, the side rail from 768 and the labelled sidebar with each
// destination's views from 1280 (AppShell, D122). Designed at 360 px; every control is 44 px or more.
// Pages keep the 960 px width until each is laid out for the wider widths (D122 rollout); a page laid out
// passes `wide`.
import { cookies, headers } from "next/headers";
import { type ReactNode, Suspense } from "react";

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
import { frameReadStatus } from "@/lib/private/read-status";
import type { Feature } from "@/lib/workspace-features";

import { AnalyticsPerson } from "./AnalyticsPerson";
import { DeletionBanner } from "./DeletionBanner";
import { type DeskView, SideNav, Tabs, VIEW_TAB } from "./DeskNav";
import { FirstUse } from "./FirstUse";
import { LanguageSwitch } from "./LanguageSwitch";
import { ProfileSheet } from "./ProfileSheet";
import { ReadStatusBar } from "./ReadStatusBar";
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
  wide = false,
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
  /** Signed in: the destinations with `current` open (and `view` inside it), and the first-use cards;
   * `on`: the features on for the workspace, so a turned-off destination is left out (D126). */
  tabs?: {
    slug: string;
    current: TabId;
    view?: DeskView;
    waiting: number;
    on: ReadonlySet<Feature>;
  };
  /** The page is laid out on the layout components (D122): the full width, not the 960 px fallback. */
  wide?: boolean;
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
        <div className="flex min-w-0 basis-full flex-wrap items-center justify-between gap-x-2 border-t border-wax-paper/25 pt-1 text-body-sm">
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
      legacyWidth={!wide}
      {...(tabs && {
        tabs: (
          <Tabs t={t} slug={tabs.slug} current={tabs.current} waiting={tabs.waiting} on={tabs.on} />
        ),
        rail: <SideNav t={t} {...tabs} wide={false} />,
        sidebar: <SideNav t={t} {...tabs} wide />,
      })}
    >
      {children}
    </AppShell>
  );
}

/** A deletion's date in the officer's language: "3 December 2026" (UTC, as the daily job counts it). */
export function deletionDate(at: Date, language: WorkspaceLanguage): string {
  const style = { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" } as const;
  return new Intl.DateTimeFormat(language, style).format(at);
}

/**
 * The 14 days before the workspace is deleted (D125), on every desk and board page: the date, and for an
 * officer "Cancel the deletion". Nothing when no deletion is asked.
 */
export function DeletionNotice(props: {
  slug: string;
  purgeAfter: Date | null;
  officer: boolean;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
}) {
  const { t, purgeAfter } = props;
  if (!purgeAfter) return null;
  const date = deletionDate(purgeAfter, props.language);
  const words = {
    line: fill(t[props.officer ? "deletion.banner" : "deletion.board"], { date }),
    more: props.officer ? t["deletion.more"] : "",
    cancel: t["deletion.cancel"],
    cancelled: t["deletion.cancelled"],
    failed: t["deletion.failed"],
  };
  return <DeletionBanner slug={props.slug} words={words} officer={props.officer} />;
}

/**
 * The frame once signed in: the alliance under the name, "Signed in as … · Sign out", the tabs with the
 * count of screenshot drafts waiting for review on Home (`waiting`, read by the page in its own
 * database read), and the read status bar under the page head (D135: the frame's only connection, streamed
 * in its own Suspense boundary so the page never waits for it).
 */
export function SignedInFrame({
  access,
  language,
  t,
  current: at,
  waiting,
  wide = false,
  keyShown = false,
  children,
}: {
  access: WorkspaceAccess;
  language: WorkspaceLanguage;
  t: WorkspaceDictionary;
  /** The open destination, or one of its views (its destination is open, and the view marked). */
  current: TabId | DeskView;
  waiting: number;
  /** Laid out for the wider widths (D122); see `Frame`. */
  wide?: boolean;
  /** The page shows the tracker key's state itself (Home's key card, Alliance settings): the read status
   * bar leaves out the lines that say the same (D135). */
  keyShown?: boolean;
  children: ReactNode;
}) {
  const view = at in VIEW_TAB ? (at as DeskView) : undefined;
  const current = view ? VIEW_TAB[view] : (at as TabId);
  const { alliance } = access;
  const person = analyticsPerson(getEnv(), {
    userId: access.user.id,
    tier: "officer",
    slug: access.slug,
    alliance,
  });
  return (
    <SignedOutProvider slug={access.slug} text={t["signedOut.text"]} link={t["signedOut.link"]}>
      <Frame
        language={language}
        t={t}
        tabs={{
          slug: access.slug,
          current,
          waiting,
          on: access.features.on,
          ...(view && { view }),
        }}
        account={<Account access={access} language={language} t={t} />}
        wide={wide}
        {...(alliance && { subtitle: `${alliance.tag} · ${alliance.name}` })}
      >
        {person && <AnalyticsPerson {...person} />}
        <DeletionNotice
          slug={access.slug}
          purgeAfter={access.purgeAfter}
          officer
          t={t}
          language={language}
        />
        <Suspense fallback={null}>
          <ReadStatusLine access={access} t={t} keyShown={keyShown} />
        </Suspense>
        {children}
      </Frame>
    </SignedOutProvider>
  );
}

/**
 * The read status bar (D135): its own database read, streamed after the page, on the `access` the page's
 * requireWorkspace gave. Nothing when no read has anything to say.
 */
async function ReadStatusLine({
  access,
  t,
  keyShown,
}: {
  access: WorkspaceAccess;
  t: WorkspaceDictionary;
  keyShown: boolean;
}) {
  // A failed read renders nothing and logs a code (`frameReadStatus`): never the desk page's error.
  const status = await frameReadStatus(access, t, new Date());
  if (!status?.lines.some((l) => !(keyShown && l.keyCard))) return null;
  const words = {
    label: t["status.label"],
    more: t["status.more"],
    settings: t["status.key.link"],
  };
  return <ReadStatusBar slug={access.slug} initial={status} words={words} keyShown={keyShown} />;
}

/** "Signed in as …" with the officer's profile, Alliance settings and Sign out. */
function Account({
  access,
  language,
  t,
}: {
  access: WorkspaceAccess;
  language: WorkspaceLanguage;
  t: WorkspaceDictionary;
}) {
  const name = access.user.displayName ?? "";
  return (
    <>
      <ProfileSheet
        slug={access.slug}
        t={t}
        language={language}
        name={name}
        label={fill(t["shell.signedIn"], { name: isolate(name) })}
      />
      <span className="ml-auto flex shrink-0 items-center">
        {/* D124: the alliance's own settings (the tracker key), apart from the officer's own. */}
        <a
          href={`/w/${access.slug}/settings`}
          className="inline-flex min-h-11 items-center px-2 text-body-sm font-semibold whitespace-nowrap underline underline-offset-4"
        >
          {t["settings.link"]}
        </a>
        <SignOutButton
          slug={access.slug}
          words={{
            label: t["shell.signOut"],
            ask: t["shell.signOutAsk"],
            stay: t["shell.stay"],
          }}
        />
      </span>
    </>
  );
}
