// The workspace's own words in English, Brazilian Portuguese and French (D71, issue #305): separate from
// lib/copy.ts, so the public pages' i18n check and payload do not change. Names and game terms stay as the
// officers write them (naming.md). French puts a no-break space before : ? and !.
import { fr } from "./dictionary.fr";
import { pt } from "./dictionary.pt-BR";

export const WORKSPACE_LANGUAGES = ["en", "pt-BR", "fr"] as const;
export type WorkspaceLanguage = (typeof WORKSPACE_LANGUAGES)[number];
/** Written by the EN · PT · FR switch; read on the server. */
export const WORKSPACE_LANG_COOKIE = "lap_ws_lang";
/** Written when an officer skips or finishes the first-use cards (#312), so they open by themselves once. */
export const WORKSPACE_INTRO_COOKIE = "lap_ws_intro";

const en = {
  "app.name": "Officers’ Desk",
  "tab.aria": "Sections",
  "tab.home": "Home",
  "tab.members": "Members",
  "tab.mark": "Roll call",
  "tab.days": "Calendar",
  "tab.review": "Follow-up",
  "tab.soon": "Soon",
  "lang.aria": "Language",
  "signin.title": "Sign in",
  "signin.lead":
    "For the alliance’s leadership: sign in with the Discord account you use in the alliance’s server.",
  "signin.button": "Sign in with Discord",
  "signin.note":
    "Discord tells us your name and your roles in that server. Nothing else, and nothing is posted.",
  "signin.e.denied": "Discord did not confirm the sign-in. Try again.",
  "signin.e.discord": "Discord did not answer. Try again in a minute.",
  "signin.e.not_configured": "Sign-in is not set up yet. The site owner has to finish it first.",
  "noaccess.title": "No access",
  "noaccess.not_member":
    "This Discord account is not in the alliance’s Discord server. Join the server, or sign in with the account you use there.",
  "noaccess.no_role":
    "This Discord account does not have a leadership role in the alliance’s server. Ask an R5 to give you the role, then sign in again.",
  "noaccess.allowlist_expired":
    "Your access was for a limited time, and that time is over. Ask the site owner to extend it.",
  "noaccess.blocked": "This account has been removed from this workspace.",
  "noaccess.retry": "Sign in again",
  "noaccess.public": "Go to the public Event Ledger",
  "shell.signedIn": "Signed in as {name}",
  "shell.signOut": "Sign out",
  "home.title": "This week",
  "home.empty": "Nothing here yet. The kettle is on.",
  "home.next":
    "The Members tab is ready: every member’s might, donations and activity, from the game.",
  "home.open": "Open Members",
  "shell.help": "How this works",
  "signin.howto": "How to put it on your phone",
  "members.lead":
    "From the game, read each night just before the server resets. Last read: {when}.",
  "members.week": "Week {from} – {to}. A week here runs from Monday to Sunday, like the game’s.",
  "members.none":
    "No end-of-day read yet. Members show up here after the first one, just before the server resets.",
  "thanks.head": "Thank you this week",
  "thanks.intro": "A few names stood out. Thank you.",
  "thanks.donors": "Top donors",
  "thanks.activity": "Most active",
  "members.search.ph": "Name (no emoji needed)",
  "members.search.aria": "Search members",
  "members.filter.aria": "Filter",
  "members.filter.all": "All",
  "members.filter.new": "New",
  "members.filter.checkin": "Check in",
  "members.filter.missing": "Missing info",
  "members.filter.r4": "R4 and R5",
  "members.count": "{n} of {total} members",
  "members.empty": "Nobody here matches. Grandma checked twice.",
  "members.copy": "Copy for spreadsheet",
  "members.copied": "Copied",
  "members.copyFailed": "Could not copy",
  "members.checkinHelp":
    "Check in shows what we saw, so you can have a friendly word. Nothing is sent to anyone, and the app never removes anybody.",
  "members.nodataHelp":
    "— means no data: that day was not read, or the game did not say. It never counts against anyone.",
  "members.new": "New",
  "members.firstSeen": "first seen {date}",
  "members.meta.level": "Sanctuary {n}",
  "members.meta.might": "Might {v}",
  "members.meta.don": "Donations {v}",
  "members.meta.act": "Activity {v}",
  "members.details": "Details",
  "members.detailsOf": "Details, {name}",
  "members.don.head": "Donations this week · total {total}",
  "members.don.later": "not read yet",
  "members.don.none": "no data",
  "members.nodata": "No data: {list}",
  "nodata.might": "might",
  "nodata.sanctuary": "Sanctuary",
  "nodata.activity": "activity",
  "nodata.donations": "donations on {n} days",
  "status.fine": "Fine",
  "status.checkin": "Check in",
  "reason.idle":
    "activity {activity} and donations {donated} unchanged for {n} days ({r} end-of-day reads in a row)",
  "reason.might": "might unchanged for {n} days",
  "reason.kvk": "no kills gained in Kingdom War (KvK) on {date}",
  "sheet.name": "Name",
  "sheet.rank": "Rank",
  "sheet.might": "Might",
  "sheet.sanctuary": "Sanctuary",
  "sheet.total": "Week total",
  "sheet.activity": "Activity this week",
  "sheet.honor": "Day’s honor",
  "sheet.joined": "Joined",
  "sheet.seen": "Seen since",
  "sheet.status": "Status",
  "sheet.lastOnline": "Last online",
  "sheet.map": "Map position",
  "sheet.mapValue": "X {x} · Y {y}",
  "day.mon": "Mon",
  "day.tue": "Tue",
  "day.wed": "Wed",
  "day.thu": "Thu",
  "day.fri": "Fri",
  "day.sat": "Sat",
  "day.sun": "Sun",
  "intro.step": "{n} of {total}",
  "intro.skip": "Skip",
  "intro.next": "Next",
  "intro.back": "Back",
  "intro.done": "Start",
  "intro.1.title": "Welcome to the Officers’ Desk",
  "intro.1.body":
    "A private page for the alliance’s R4 and R5. It fills in what the spreadsheets asked for: who is in the alliance, their might, donations and activity. Only the leadership can open it.",
  "intro.2.title": "Where the numbers come from",
  "intro.2.body": "A small label next to a number says where it comes from:",
  "intro.2.more":
    "Today everything is from the game, read every night just before the server resets. Photos and officers’ answers come later.",
  "intro.3.title": "What to do each week",
  "intro.3.body":
    "Open Members. Start with the thank-you list. Then look at anyone marked Check in: what we saw is written under the name.",
  "intro.3.more":
    "You decide what to do. Nothing is sent to anyone, and — (no data) never counts against anyone.",
  "intro.4.title": "Your language",
  "intro.4.body":
    "Tap EN, PT or FR at the top. The page changes at once, and this phone remembers it.",
  "intro.4.more": "Tap ? at the top to see these cards again.",
  "src.game": "from the game",
  "src.photo": "from a photo",
  "src.officer": "typed by an officer",
  "howto.title": "How to open the Officers’ Desk",
  "howto.lead": "For the alliance’s R4 and R5. Pin this page in your Discord.",
  "howto.address": "1. Open this address in your phone’s browser",
  "howto.signin": "2. Sign in with Discord",
  "howto.signin.body":
    "Tap “Sign in with Discord”. Discord asks whether LAPTracker may see your name and your roles in the alliance’s server: tap Authorize. If the page then says No access, ask an R5 for the leadership role.",
  "howto.iphone": "3. iPhone: add it to the home screen",
  "howto.iphone.body":
    "In Safari, tap Share (the square with an arrow), then Add to Home Screen, then Add.",
  "howto.android": "4. Android: add it to the home screen",
  "howto.android.body":
    "In Chrome, tap ⋮ at the top right, then Add to Home screen (or Install app), then Add.",
  "howto.after":
    "From then on, tap the icon like any app. You stay signed in for a day; after that, Discord checks your role again.",
  "howto.open": "Open the Officers’ Desk",
  "time.server": "{time} server time",
} as const;

export type WorkspaceKey = keyof typeof en;
export type WorkspaceDictionary = Record<WorkspaceKey, string>;

export const WORKSPACE_DICTIONARIES: Record<WorkspaceLanguage, WorkspaceDictionary> = {
  en,
  "pt-BR": pt,
  fr,
};

/** A Map, not an object: a header tag such as `constructor` or `__proto__` must find nothing. */
const BASE = new Map<string, WorkspaceLanguage>([
  ["en", "en"],
  ["pt", "pt-BR"],
  ["fr", "fr"],
]);

/** The switch's cookie, else the first Accept-Language tag in one of the three, else English. */
export function pickWorkspaceLanguage(
  cookie: string | undefined,
  acceptLanguage: string | null,
): WorkspaceLanguage {
  if (WORKSPACE_LANGUAGES.includes(cookie as WorkspaceLanguage)) return cookie as WorkspaceLanguage;
  const tags = (acceptLanguage ?? "").split(",").map((t) => t.split(";")[0]?.trim().toLowerCase());
  for (const tag of tags) {
    const language = BASE.get(tag?.split("-")[0] ?? "");
    if (language) return language;
  }
  return "en";
}
