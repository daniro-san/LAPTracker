// The error pages' words (Phase 5b; D143's "Data temporarily unavailable"), `copy.errors` in lib/copy.ts.
// Public: translated like the rest (lib/i18n), split out for lib/copy.ts's length.
export const errorsCopy = {
  notFound: {
    code: "404",
    title: "Grandma wandered off.",
    body: "This page isn't in the ledger.",
    back: "Back to the ledger",
  },
  server: {
    code: "500",
    title: "Something cracked.",
    body: "Something broke on our side. Try again in a minute.",
    retry: "Try again",
    back: "Back to the ledger",
  },
  /** The database does not answer and nothing is kept for the page (D143); its buttons are `server`'s. */
  unavailable: {
    code: "503",
    title: "Data temporarily unavailable.",
    body: "The ledger can't be read right now. Nothing is lost. Try again in a few minutes.",
  },
};
