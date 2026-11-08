// The /brand page's Components section text (app/(pages)/brand/ComponentsSection.tsx), split out of
// lib/copy-brand.ts to keep each file readable; it is `copy.brand.components`.
export const brandComponentsCopy = {
  title: "Components",
  lede: "The whole set. Anything else is a composition of these; a new piece needs a line in docs/DESIGN.md first.",
  primary: {
    name: "Primary button",
    label: "Find a player",
    use: "Plum face over pen hatching. The main action, one per view at most.",
  },
  secondary: {
    name: "Secondary button",
    label: "Cancel",
    use: "Paper face in the drawn frame. Every other action.",
  },
  seal: { name: "Seal button", label: "Run now", use: "Confirm or destructive actions only." },
  chips: {
    name: "Chips",
    use: "Snapshot status: colour, icon and word together. Ink done, plum running, seal partial or failed, muted not yet.",
    before: "Before",
    after: "After",
    done: "done",
    running: "running",
    partial: "partial",
    notYet: "not taken yet",
  },
  memberMark: {
    name: "Member mark",
    use: "A footnote star after a falling Might or Kills change when members left; the legend item explains it. Never a sentence on the row.",
    sample: "▼ −3.2M (−0.4%)",
  },
  badge: {
    name: "Badge",
    label: "Test",
    use: "Sage, for neutral facts: test data, source, manual.",
  },
  field: {
    name: "Fields",
    use: "Text fields and selects in the soft drawn frame, 44 px tall.",
    label: "Player name",
    select: "Sort by",
    options: ["Might", "Kills", "Name"],
  },
  check: {
    name: "Check field",
    use: "A framed box that fills with the stitched check, its label and a line saying what ticking it changes. The row is for forms; the chip sits beside a page title.",
    label: "Post to the public channel",
    help: "Posts a message when a snapshot finishes.",
    chip: "Exact numbers",
  },
  radio: {
    name: "Radio field",
    use: "One option of an exclusive choice, framed, with a line saying what it does. Use instead of a select when there are three options or fewer.",
    legend: "Who can see it",
    options: [
      ["Only me", "Hidden from every public page."],
      ["Public", "Anyone can open it."],
    ],
  },
  notice: {
    name: "Notice",
    use: "What is happening or just happened, announced politely. Icon, colour and words together: ink done, plum running, seal failed.",
    ok: "Saved.",
    busy: "A run is in progress.",
    fail: "Before snapshot failed.",
    info: "Not due until Sat 10:00.",
  },
  facts: {
    name: "Fact list",
    use: "Label and value pairs, one per line, for a summary of settings or state.",
    items: [
      ["Name", "Manual round"],
      ["Before snapshot", "done"],
      ["Discord post", "off"],
    ],
  },
  adminSection: {
    name: "Admin section",
    use: "Each /admin section in a flat 1 px frame: its title, a state chip or note on the right, one help line, then labelled facts. No shadow, no rounded corner.",
    title: "Status",
    value: "Halloween war · After snapshot",
    state: "done 14:02",
  },
  live: {
    name: "Live indicator",
    use: "In the admin nav on every admin page: the candle sways and its glow flickers while a run is in progress, dimmed when idle, still under reduced motion. The word is always beside it; it is not a control.",
  },
  costTag: {
    name: "Cost tag",
    use: "Beside or under every admin action: what pressing it spends.",
  },
  phases: {
    name: "Round phase states",
    use: "Each phase of a manual round says what to do next: not started, running since, done, partly done, failed and why.",
  },
  runTrace: {
    name: "Run trace",
    use: "The run page's upstream calls: one line per call in the order they finished, its seconds, HTTP status, cached and retries, then a total. The slowest call says so in words. Cards on a phone, a table from 640 px.",
    tags: ["OGs", "URSA"],
  },
  rule: {
    name: "Drawn rule",
    use: "Section dividers and the footer top. Tables keep plain 1 px rules.",
  },
  roleMark: {
    name: "Role mark",
    use: "Alliance roles, in the member list and on the player page. The crown is the R5 leader (plum). A titled R4 officer (sage) gets the drawing of the title: dove, horn, crossed swords or eye; any other title gets the stitch star. A member row also takes the role's pale tint. Only these two ranks are marked. The word for the role is always in the text or read out, never colour or shape alone.",
    leader: "Leader",
    officers: ["Diplomat", "Recruiter", "God of War", "Goddess", "Any other title"],
  },
  leadership: {
    name: "Leadership section",
    use: "Above the member list: the R5 leader, then each R4 with a title, as cards with photo, name, role, Might, Kills and Level. The tracker's Militarist and Overseer read God of War and Goddess, the game's names; any other title is shown as it comes. Left out when the alliance has none.",
  },
  movers: {
    name: "Movers",
    use: "The event's biggest gains and losses, under the ledger and on the alliance page between Leadership and the members. Three tabs, Might ▲, Might ▼ and Kills ▲, each a ranked list of #rank, name and change. An empty list reads —. No sentences.",
    gains: ["[OGs] OldGrandmas", "[NSE] Natural Selection"],
    loss: "[URSA] Ursus Invictus",
  },
  lace: { name: "Lace", use: "Under the header, and nowhere else." },
  settings: {
    name: "Settings gear",
    use: "The last control in the header, on every page. Its panel holds the theme, the times (server time or the viewer's own zone) and the date order; each choice is a cookie for that browser. On /admin it holds the theme only, because the admin area stays in server time.",
  },
  corner: {
    name: "Yarn corner",
    use: "One footer corner per page. The Granny Doctor takes it on error and player pages.",
  },
} as const;
