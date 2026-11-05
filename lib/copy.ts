// Every user-facing string added from Session 7 on (docs/DESIGN.md "Language-light rules"). Keys are
// stable identifiers; values are the English text, so translation later is a file, not a refactor.
// Session 7b moves the Session 6/6b strings here too.
export const copy = {
  site: {
    name: "OG's LAP Tracker",
    byline: "kept by the Old Grandmas",
    ledger: "Server 325 · Saturday Ledger",
    players: "Players",
  },
  brand: {
    title: "Brand sheet",
    intro: "Mock for review. Nothing on this page reads the database.",
    mark: {
      title: "The mark",
      large: "200 px",
      small: "24 px, on paper and on plum",
    },
    palette: {
      title: "Palette",
      roles: {
        paper: "Paper — the page",
        ink: "Ink — all text",
        plum: "Plum — header, links, focus",
        seal: "Seal — losses, errors, stale",
        yarn: "Yarn — gains, highlights",
        sage: "Sage — neutral badges",
        rule: "Rule — borders, table rules",
      },
      proposal: "Proposed for light-mode text (contract value fails 4.5:1 on paper)",
      proposalRoles: {
        yarnDeep: "Yarn, deeper — 5.1:1",
        sageDeep: "Sage, deeper — 5.0:1",
      },
      contrast: { yarn: "2.2:1 on paper", sage: "3.5:1 on paper" },
    },
    type: {
      title: "Type",
      displayLg: "Saturday Ledger",
      displayMd: "Gained and lost",
      displaySm: "Nothing recorded yet. The kettle is on.",
      displayNote: "Cormorant Garamond 600 — 32 / 24 / 20 px",
      body: "Might, kills and members for the top alliances on server 325, before and after the event.",
      bodySm: "Updated 16:01 server time.",
      bodyNote: "Source Sans 3 — 16 / 14 px, numerals tabular",
      label: "Gained / Lost",
    },
    ornaments: {
      title: "Ornaments",
      lace: "Lace border, under the header",
      corner: "Yarn corner, one per page (bottom left of this page)",
    },
    controls: {
      title: "Controls",
      seal: "Run now",
      sealNote: "Wax seal: confirm or destructive actions only",
      primary: "Find a player",
      badge: "Test",
    },
    status: {
      title: "Snapshot status",
      before: "Before",
      after: "After",
      running: "running",
      complete: "done",
      partial: "partial",
    },
    row: {
      title: "Ledger row",
      lead: "Alliance",
      might: "Might",
      kills: "Kills",
      members: "Members",
      membersNote: "+2 / −3",
    },
  },
} as const;
