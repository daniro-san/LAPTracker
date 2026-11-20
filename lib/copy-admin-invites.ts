// /admin's New alliances card (D130, issue 453), re-exported as `copy.admin.invites`. English only (D48).
export const invitesAdminCopy = {
  title: "New alliances",
  help: "Invite an alliance's leadership, or answer their request for a Desk. The link works once, for 7 days. Their leader signs in with Discord, picks the server and the roles, and gets the Officers' Desk with the defaults for new alliances.",
  create: {
    head: "Invite an alliance",
    alliance: "Alliance",
    button: "Create the invite link",
    none: "Every tracked alliance already has a workspace.",
  },
  link: {
    head: "Invite link for {alliance}",
    help: "Send it to the alliance's R5 or R4, on Discord or in game mail. It works once, until {date}. This page shows it only now: a new link cancels this one. For a request, they also see Approved and a Continue button on their request page, so sending it is a second way in.",
    copy: "Copy the link",
    copied: "Copied.",
  },
  invites: {
    head: "Invite links",
    none: "No invite link yet.",
    made: "made {date}",
    cancel: "Cancel the link",
    cancelAsk: "Cancel the invite link for {alliance}? It stops working at once.",
    state: {
      waiting: "not used yet · works until {date}",
      signedIn: "{name} signed in with Discord · works until {date}",
      server: "{name} picked the server; roles next · works until {date}",
      used: "used: /w/{slug}",
      expired: "expired {date}",
      cancelled: "cancelled",
    },
  },
  requests: {
    head: "Requests",
    none: "No request yet.",
    line: "{alliance} · {player} · says {claimed} · {date}",
    approve: "Approve and make the link",
    decline: "Decline",
    reason: "Reason shown to them (optional)",
    declineYes: "Decline the request",
    approved: "Approved {date}",
    declined: "Declined {date}",
  },
  claimed: { r5: "R5 (leader)", r4: "R4" },
  roster: {
    found: "Roster says: {rank}, seen {date}",
    notFound: "Name not found in the roster",
    noRank: "in the alliance",
  },
  discordLine:
    "Desk requested: {alliance} · {player} says {claimed} · {roster}. Answer it on /admin#new-alliances.",
  errors: {
    has_workspace: "This alliance already has a workspace.",
    decided: "This request was already answered.",
    not_found: "Not found. Reload the page.",
    unauthorized: "The PIN is wrong.",
    rate_limited: "Too many tries. Wait 15 minutes.",
    failed: "Something went wrong. Try again.",
  },
} as const;
