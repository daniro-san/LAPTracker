// The workspace's own words in English, Brazilian Portuguese and French (D71, issue #305): separate from
// lib/copy.ts, so the public pages' i18n check and payload do not change. Names and game terms stay as the
// officers write them (naming.md). French puts a no-break space before : ? and !.
import { activityEn } from "./dictionary.activity";
import { boardEn } from "./dictionary.board";
import { calendarEn } from "./dictionary.calendar";
import { dataEn } from "./dictionary.data";
import { featuresEn } from "./dictionary.features";
import { followUpEn } from "./dictionary.followup";
import { fr } from "./dictionary.fr";
import { garrisonEn } from "./dictionary.garrison";
import { importEn } from "./dictionary.import";
import { lifecycleEn } from "./dictionary.lifecycle";
import { membersEn } from "./dictionary.members";
import { noticesEn } from "./dictionary.notices";
import { profileEn } from "./dictionary.profile";
import { pt } from "./dictionary.pt-BR";
import { rollEn } from "./dictionary.rollcall";
import { settingsEn } from "./dictionary.settings";
import { shareEn } from "./dictionary.share";
import { shotsEn } from "./dictionary.shots";
import { squadsEn } from "./dictionary.squads";
import { theftsEn } from "./dictionary.thefts";
import { translateEn } from "./dictionary.translate";

export const WORKSPACE_LANGUAGES = ["en", "pt-BR", "fr"] as const;
export type WorkspaceLanguage = (typeof WORKSPACE_LANGUAGES)[number];

const en = {
  ...calendarEn,
  ...membersEn,
  ...rollEn,
  "app.name": "Officers’ Desk",
  "tab.aria": "Sections",
  "tab.home": "Home",
  "tab.members": "Members",
  "desk.more": "More",
  "tab.mark": "Roll call",
  "tab.days": "Calendar",
  "tab.soon": "Soon",
  "lang.aria": "Language",
  "signin.title": "Sign in",
  "signin.lead":
    "Sign in with the Discord account you use in the alliance’s server. Members see this week’s plan, the notices and Start here; officers also get the Officers’ Desk.",
  "signin.button": "Sign in with Discord",
  "signin.note": "Discord shares only your name and your roles in that server. Nothing is posted.",
  "signin.e.denied": "Discord did not confirm the sign-in. Try again.",
  "signin.e.discord": "Discord did not answer. Try again in a minute.",
  "signin.e.not_configured": "Sign-in is not set up yet. The site owner has to finish it first.",
  "noaccess.title": "No access",
  "noaccess.not_member":
    "This Discord account is not in the alliance’s Discord server. Join the server, or sign in with the account you use there.",
  "noaccess.no_role":
    "This Discord account doesn’t have the alliance’s member role yet. Once an officer gives it to you, sign in again.",
  "noaccess.board_closed":
    "The members’ board is not open yet. Your officers will say on Discord when it is.",
  "noaccess.allowlist_expired":
    "Your access was for a limited time, and that time is over. Ask the site owner to extend it.",
  "noaccess.blocked":
    "This Discord account no longer has access to the alliance’s pages here: the members’ board or the Officers’ Desk. Ask an R5 if this is a mistake.",
  "noaccess.retry": "Sign in again",
  "noaccess.public": "Go to the public Event Ledger",
  "shell.signedIn": "Signed in as {name}",
  "shell.signOut": "Sign out",
  "shell.signOutAsk": "Sign out? The text you have not saved on this page is lost.",
  "shell.stay": "Stay signed in",
  "signedOut.text": "You were signed out. Your text is still here.",
  "signedOut.link": "Sign in again (opens a new tab), then try again here.",
  "home.title": "Home",
  "home.next.head": "Today and tomorrow",
  "home.today": "Today",
  "home.tomorrow": "Tomorrow",
  "home.next.none": "Nothing on the Calendar today or tomorrow.",
  "home.calendar": "Open Calendar",
  "home.members.head": "Members this week",
  "home.notYet": "Nothing yet. Thanks and check-ins appear after the first daily update.",
  "home.open": "Open Members",
  "shell.help": "How this works",
  "signin.howto": "How to put it on your phone",
  "members.none":
    "No data yet. Members appear after the first daily update, just before the server resets.",
  "thanks.head": "Top this week",
  "thanks.intro": "Thank them in the game.",
  "thanks.donors": "Top donors",
  "thanks.activity": "Most active",
  "members.search.ph": "Name (no emoji needed)",
  "members.search.aria": "Search members",
  "members.filter.aria": "Filter",
  "members.filter.r4": "R4 and R5",
  "members.count": "{n} of {total} members",
  "members.empty": "No one matches these filters.",
  "members.copy": "Copy for spreadsheet",
  "members.copied": "Copied",
  "members.copyFailed": "Could not copy. Try again.",
  "members.new": "New",
  "members.firstSeen": "first seen {date}",
  "members.meta.level": "Sanctuary {n}",
  "members.meta.might": "Might {v}",
  "members.meta.don": "Donations {v}",
  "members.meta.act": "Activity {v}",
  "members.don.head": "Donations this week · total {total}",
  "members.don.later": "no update yet",
  "members.don.none": "no data",
  "members.nodata": "No data: {list}",
  "nodata.might": "might",
  "nodata.sanctuary": "Sanctuary",
  "nodata.activity": "activity",
  "status.fine": "Fine",
  "status.checkin": "Check in",
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
  "intro.2.title": "Where the numbers come from",
  "intro.2.body": "A small label next to a number says where it comes from:",
  "src.game": "from the game",
  "src.photo": "from a screenshot",
  "src.officer": "typed by an officer",
  "howto.title": "How to open the Officers’ Desk",
  "howto.lead": "For the alliance’s R4 and R5. Pin this page in your Discord.",
  "howto.after":
    "Then open it from the icon, like any app. You stay signed in for a day. After that, Discord checks your role again.",
  "howto.open": "Open the Officers’ Desk",
  "time.server": "{time} server time",
  "tab.review": "Follow-up",
  "members.lead": "Updated once a day, just before the server resets.",
  "members.lastRead": "Last update: {when}",
  "members.week": "Week: {from} – {to}",
  "members.more": "What the labels mean",
  "members.checkinHelp": "Check in: ask how they are. You decide what to do.",
  "members.nodataHelp": "No data yet. Missing data never counts against anyone.",
  "nodata.mark": "No data",
  "members.checkinCount.one": "{n} person to check in with or help",
  "members.checkinCount.other": "{n} people to check in with or help",
  "members.checkinNone": "Everyone looks fine this week.",
  "reason.might.one": "might unchanged for {n} day",
  "reason.might.other": "might unchanged for {n} days",
  "reason.idle.one": "no new donations or activity for {n} day",
  "reason.idle.other": "no new donations or activity for {n} days",
  "nodata.donations.one": "donations on {n} day",
  "nodata.donations.other": "donations on {n} days",
  "howto.address": "1. Open this address",
  "howto.where": "Open it in Safari or Chrome, not inside Discord.",
  "howto.copy": "Copy the address",
  "howto.copied": "Copied",
  "howto.copyFailed": "Could not copy. Try again.",
  "howto.signin": "2. Sign in with Discord",
  "howto.home": "3. Add it to the home screen",
  "howto.iphone": "On iPhone",
  "howto.android": "On Android",
  "intro.1.body":
    "Who is in the alliance, with each member’s might, donations and activity, from the game. Use it instead of the spreadsheets.",
  "intro.1.settings": "Tap your name at the top for your settings.",
  "intro.only": "R4 · R5 only",
  "intro.2.more": "A dotted circle means no data yet. Missing data never counts against anyone.",
  "intro.desk.title": "Calendar, screenshots and Discord",
  "intro.desk.calendar":
    "Calendar: what is on, in server time and in your time. Notices and Thefts are tabs inside it.",
  "intro.desk.shots":
    "Home: Send screenshots of a ranking or a report from the game. Check each one, then save it.",
  "intro.desk.discord":
    "In Discord, on a message with screenshots: Apps → Send to LAPTracker. They wait on Home.",
  "intro.3.title": "Each week",
  "intro.3.body":
    "Open Members and start at the top: thank the members who did the most this week.",
  "intro.3.more":
    "Then look at anyone marked Check in. The reason is under the name. A short message in the game is often enough.",
  "intro.3.note": "The desk never messages anyone. You decide who to talk to.",
  "intro.3.last": "EN · PT · FR at the top switches language. ? brings these cards back.",
  "intro.replay": "Show the tips",
  "intro.close": "Close",
  "sheet.close": "Close",
  "sheet.cancel": "Cancel",
  "sheet.ask": "Discard your changes?",
  "sheet.keep": "Keep editing",
  "sheet.discard": "Discard",
  "howto.signin.body":
    "Tap “Sign in with Discord”. Discord asks whether LAPTracker (this desk) may see your name and your roles in the alliance’s server: tap Authorize.",
  "howto.help": "Can’t get in? Ask an R5 on Discord.",
  "howto.iphone.body":
    "In Safari, tap the Share icon (a square with an arrow pointing up). In the list, tap the item with a + in a square, then confirm.",
  "howto.android.body":
    "In Chrome, tap ⋮ at the top right. In the menu, tap the item that adds the page to your home screen (a phone with an arrow), then confirm.",
  "howto.share":
    "Sharing screenshots: on Android, add the desk to your home screen from a desk page (this address, not the public site), so the icon is “Officers’ Desk”. Then open a screenshot in your gallery, tap Share and pick “Officers’ Desk”. The desk opens on the drafts to review. A share holds about 4 MB in all, around 2 or 3 screenshots; for more, use Send screenshots in the desk. If the desk is not in the Share list, remove its icon and add it again from here. On iPhone, sharing to the desk is not possible: use Send screenshots in the desk or the Discord command “Send to LAPTracker”.",
  "status.break": "On a break",
  "status.breakUntil": "On a break until {date}",
  "status.help": "Needs help",
  "members.early":
    "Roster from {when} · donations and activity come with the first daily update, after {time} server time.",
  "members.import": "Import the old spreadsheets",
  "src.message": "from a message",
  "src.sheet": "from the sheet",
  "facts.head": "Member info",
  "facts.squadMight": "Main squad might",
  "facts.adTech": "AD Tech",
  "facts.troopTier": "Troops",
  "facts.timeZone": "Time zone",
  "facts.languages": "Languages",
  "facts.status": "Status",
  "facts.away": "Away",
  "facts.notes": "Notes",
  "facts.until": "until {date}",
  "facts.awayRange": "{from} – {to}",
  "facts.awayOrder": "The first day must be on or before the last day.",
  "facts.edit": "Edit info",
  "facts.paste": "Paste what they told you",
  "facts.title": "Info: {name}",
  "facts.save": "Save",
  "facts.failed": "Could not save. Try again.",
  "facts.computed": "Automatic (now: {status})",
  "facts.awayText": "What they said",
  "facts.awayFrom": "First day away",
  "facts.awayDay": "Last day away",
  "facts.mightHint": "12.3 or 12,300,000",
  "facts.adHint": "0 to 100",
  "facts.theirs": "Keep {theirs}",
  "facts.mine": "Use {mine}",
  "paste.help":
    "Paste the chat here, then tap Fill the fields. Nothing is saved until you tap Save.",
  "paste.read": "Fill the fields",
  "paste.nothing": "Nothing found. Type the values below.",
  "paste.zones": "Other matches",
  "tz.choose": "Choose",
  "tz.search": "City, country, PST, ST +3…",
  "tz.searchAria": "Search time zones",
  "tz.theirTime": "Their time now",
  "tz.st": "ST is server time ({offset}).",
  "tz.more": "{n} more: keep typing.",
  "tz.none": "No time zone matches.",
  "tz.now": "now {time}",
  "facts.conflictBar":
    "Another officer changed {field} while you were editing. Answer under {field}, then Save.",
  "facts.conflictField": "Another officer saved {theirs}. You typed {mine}.",
  "facts.mergedLine": "Combined with another officer’s edit: {fields}.",
  "src.unsaved": "from this message · not saved",
  "paste.found.one": "Found {n} value. Check it, then Save.",
  "paste.found.other": "Found {n} values. Check them, then Save.",
  ...profileEn,
  ...noticesEn,
  ...importEn,
  ...lifecycleEn,
  ...theftsEn,
  ...shotsEn,
  ...translateEn,
  ...boardEn,
  ...followUpEn,
  ...activityEn,
  ...shareEn,
  ...squadsEn,
  ...garrisonEn,
  ...settingsEn,
  ...dataEn,
  ...featuresEn,
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
