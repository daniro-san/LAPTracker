// /admin's KvK opponent card (D152, issue 306), as `copy.admin.kvk`. English only (D48).
export const kvkAdminCopy = {
  title: "KvK opponent",
  help: "The server our server meets in a Saturday's KvK, and its alliances' tags. Saving the server reads its ranks board once and suggests its 15 largest alliances; you can also copy the tags from the game's KvK ranking. Each tag costs one call at the Start and one at the End.",
  /** The picker's label and one option: `Sat, Nov 28 · next` / `Sat, Nov 21`. */
  event: "KvK",
  next: "{day} · next",
  server: "Server",
  tags: "Tags (up to 15, separated by spaces or commas)",
  /** The server's ranks board suggestion (D155). */
  suggest: {
    /** `Suggested from server 326's ranks board, read 16:05 ST.` */
    from: "Suggested from server {server}'s ranks board, read {time} ST. Untick what you don't want, then save.",
    failed: "Server {server}'s ranks board couldn't be read. Type the tags as before.",
    running: "Reading server {server}'s ranks board…",
    button: "Suggest tags",
    chips: "Suggested tags",
    /** One chip: `XQZ · 4.1B`. */
    chip: "{tag} · {might}",
    other: "Other tags (separated by spaces or commas)",
  },
  save: "Save opponent",
  saved: "Saved.",
  /** After the war: the tags can no longer change. */
  locked: "The war has started: the server and tags are kept as they were read.",
  result: "Result (only on /admin)",
  results: { won: "Won", lost: "Lost", none: "Not set" },
  reads: "Reads",
  /** One tag's line: `XQZ · Start: read (Enemy name) · End: not read yet`. */
  read: "{tag} · Start: {start} · End: {end}",
  state: {
    read: "read",
    readName: "read ({name})",
    stale: "stale",
    none: "not read yet",
  },
  noReads: "Nothing read yet: the Start reads the tags at 10:00 ST.",
  errors: {
    bad_request:
      "Check the server (1–9999, not ours) and the tags (up to 15, 12 characters each, no spaces or / ? # %).",
    not_a_kvk: "That KvK is not offered any more. Reload the page.",
    no_opponent: "Save the server first.",
    opponent_read: "The Start already read this opponent: its server cannot change.",
    war_started: "The war has started: the server and tags can no longer change.",
    snapshot_running: "A Start or End is running now. Try again in a few minutes.",
    failed: "That did not save. Try again.",
  },
} as const;
