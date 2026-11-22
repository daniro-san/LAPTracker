// /admin/feedback (D157, issue 713), English only (D48): what officers and members sent from the desk and
// the board, the owner's filters and the four statuses.
export const feedbackAdminCopy = {
  title: "Feedback",
  lead: "What officers and members sent from the desk and the board, newest first. No sender is stored. Rows go after 180 days.",
  kind: "Kind",
  status: "Status",
  all: "All",
  kinds: { idea: "Idea", problem: "Problem", good: "Something good" },
  statuses: { new: "New", read: "Read", issue: "Became an issue", dropped: "Dropped" },
  areas: { desk: "desk", board: "board" },
  tiers: { officer: "officer", member: "member" },
  none: "No feedback here yet.",
  shown: "The newest {n} shown.",
  setStatus: "Set the status",
  saving: "Saving…",
  failed: "Could not save the status. Try again.",
  gone: "This item is gone (purged or deleted).",
} as const;
