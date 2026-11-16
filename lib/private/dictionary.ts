// The workspace's own words in English, Brazilian Portuguese and French (D71, issue #305): separate from
// lib/copy.ts, so the public pages' i18n check and payload do not change. Names and game terms stay as the
// officers write them (naming.md). French puts a no-break space before : ? and !.
import { fr } from "./dictionary.fr";
import { pt } from "./dictionary.pt-BR";

export const WORKSPACE_LANGUAGES = ["en", "pt-BR", "fr"] as const;
export type WorkspaceLanguage = (typeof WORKSPACE_LANGUAGES)[number];

const en = {
  "app.name": "Officers’ Desk",
  "tab.aria": "Sections",
  "tab.home": "Home",
  "tab.members": "Members",
  "tab.mark": "Roll call",
  "tab.days": "Calendar",
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
  "src.photo": "from a photo",
  "src.officer": "typed by an officer",
  "howto.title": "How to open the Officers’ Desk",
  "howto.lead": "For the alliance’s R4 and R5. Pin this page in your Discord.",
  "howto.after":
    "From then on, tap the icon like any app. You stay signed in for a day; after that, Discord checks your role again.",
  "howto.open": "Open the Officers’ Desk",
  "time.server": "{time} server time",
  "tab.review": "Follow-up",
  "members.lead": "From the game, read each night just before the server resets.",
  "members.lastRead": "Last read: {when}",
  "members.week": "Week: {from} – {to}",
  "members.weekHelp": "A week here runs from Monday to Sunday, like the game’s.",
  "members.legend": "Check in shows what we saw. — means no data.",
  "members.more": "More",
  "members.checkinHelp":
    "Check in shows what we saw, so you can have a friendly word. You decide what to do; nothing is sent or changed by itself.",
  "members.nodataHelp": "— means no data. It is left out of every count.",
  "members.checkinCount.one": "{n} person to check in with",
  "members.checkinCount.other": "{n} people to check in with",
  "members.checkinNone": "Everyone looks fine this week.",
  "members.search.go": "Search",
  "reason.might.one": "might unchanged for {n} day",
  "reason.might.other": "might unchanged for {n} days",
  "reason.idle.one":
    "activity {activity} and donations {donated} unchanged for {n} day ({r} end-of-day reads in a row), no away note",
  "reason.idle.other":
    "activity {activity} and donations {donated} unchanged for {n} days ({r} end-of-day reads in a row), no away note",
  "nodata.donations.one": "donations on {n} day",
  "nodata.donations.other": "donations on {n} days",
  "howto.address": "1. Open this address",
  "howto.where": "Open it in Safari or Chrome, not inside Discord.",
  "howto.copy": "Copy the address",
  "howto.copied": "Copied",
  "howto.copyFailed": "Could not copy",
  "howto.signin": "2. Sign in with Discord",
  "howto.home": "3. Add it to the home screen",
  "howto.iphone": "On iPhone",
  "howto.android": "On Android",
  "intro.1.body":
    "The leadership’s own place for the alliance: who is in it, their might, donations and activity, filled in from the game. It replaces the spreadsheets.",
  "intro.only": "R4 · R5 only",
  "intro.2.more": "— means no data, and it is left out of every count.",
  "intro.3.title": "Each week",
  "intro.3.body":
    "Open Members. Start with the thank-you list, then look at anyone marked Check in: what we saw is written under the name.",
  "intro.3.more": "You decide what to do; nothing is sent by itself.",
  "intro.3.last": "Tap EN · PT · FR to switch. Tap ? to see this again.",
  "intro.replay": "Replay",
  "intro.close": "Close",
  "howto.signin.body":
    "Tap “Sign in with Discord”. Discord asks whether LAPTracker may see your name and your roles in the alliance’s server: tap Authorize.",
  "howto.help": "Can’t get in? Ask an R5 on Discord.",
  "howto.iphone.body":
    "In Safari, tap the Share icon (a square with an arrow pointing up). In the list, tap the item with a + in a square, then confirm.",
  "howto.android.body":
    "In Chrome, tap ⋮ at the top right. In the menu, tap the item that adds the page to your home screen (a phone with an arrow), then confirm.",
  "status.break": "On a break",
  "status.breakUntil": "On a break until {date}",
  "status.help": "Needs help",
  "members.early":
    "Roster from {when} · donations and activity come with the first end-of-day read, after {time} server time.",
  "members.import": "Import the old spreadsheets",
  "src.message": "from a message",
  "src.sheet": "from the sheet",
  "facts.head": "Member facts",
  "facts.squadMight": "Main squad",
  "facts.adTech": "AD Tech",
  "facts.troopTier": "Troops",
  "facts.timeZone": "Time zone",
  "facts.languages": "Languages",
  "facts.status": "Status",
  "facts.away": "Away",
  "facts.notes": "Notes",
  "facts.until": "until {date}",
  "facts.edit": "Edit facts",
  "facts.paste": "Paste what they told you",
  "facts.title": "Facts: {name}",
  "facts.save": "Save",
  "facts.cancel": "Cancel",
  "facts.failed": "Could not save. Try again.",
  "facts.computed": "As we see it",
  "facts.awayText": "What they said",
  "facts.awayDay": "Last day away",
  "facts.mightHint": "9.9M or 9,900,000",
  "facts.conflict": "Another officer saved this meanwhile: {value}",
  "facts.theirs": "Keep theirs",
  "facts.mine": "Use mine",
  "facts.merged": "Combined with another officer’s edit.",
  "paste.help":
    "Paste the chat here. What we find fills the fields below, marked “from a message”. Check it, then save.",
  "paste.read": "Read",
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
  "import.lead":
    "Once only. Paste a sheet, or choose its CSV file: OG TRACKING, Might and ADp, a participation week. Each row is matched to a member, and you confirm the doubtful ones. Values go only into empty fields, marked “from the sheet”.",
  "import.paste": "The sheet (CSV, or cells copied from the spreadsheet)",
  "import.file": "Or choose a CSV file",
  "import.check": "Check the rows",
  "import.noName": "No “Name” column found. Paste the sheet with its header row.",
  "import.columns": "Read: {list}",
  "import.ignored": "Not imported: {list}",
  "import.summary": "{rows} rows · {matched} matched · {open} to check · {dismissed} not members",
  "import.isIt": "Is it…",
  "import.someone": "Someone else",
  "import.dismiss": "Not a member",
  "import.dismissAll": "Not members: every row with no match ({n})",
  "import.change": "Change",
  "import.matched": "Matched rows ({n})",
  "import.role": "In the sheet: {role}",
  "import.zone": "Time zone not understood: {text}",
  "import.apply": "Import",
  "import.left": "Still to check: {n}",
  "import.done":
    "Done: {saved} values saved for {members} members. {kept} kept, because the field already had a value.",
  "import.failed": "Could not import. Try again.",
  "import.again": "Import another sheet",
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
