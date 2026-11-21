// /admin/changes, the patch notes (lib/patch-notes.ts), as `copy.admin.changes`. English only (D48).
export const changesAdminCopy = {
  title: "Patch notes",
  todo: {
    title: "Your to-do",
    help: "Steps only you can do. Done ones are at the bottom.",
    open: "{n} open",
    none: "Nothing open.",
    done: "Done",
  },
  releases: {
    title: "Releases",
    help: "Newest first. Tap a release to open or close it.",
    needsYou: "Needs you",
    prs: "Pull requests",
  },
} as const;
