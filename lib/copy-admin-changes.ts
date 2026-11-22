// /admin/changes, the patch notes (lib/patch-notes.ts), as `copy.admin.changes`. English only (D48).
export const changesAdminCopy = {
  title: "Patch notes",
  todo: {
    title: "Your to-do",
    help: "Every step only you can do, from every release, in one list. Done ones are at the bottom.",
    open: "{n} open",
    none: "Nothing open.",
    done: "Done",
  },
  releases: {
    title: "Releases",
    help: "Newest first. Tap a release to open or close it.",
    prs: "Pull requests",
  },
} as const;
