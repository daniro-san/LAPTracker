// The feedback table's closed lists (D157), apart from lib/schema-feedback.ts so client components can use them
// without pulling Drizzle into the browser. Imports nothing.
export const FEEDBACK_AREAS = ["desk", "board"] as const;
export const FEEDBACK_KINDS = ["idea", "problem", "good"] as const;
export const FEEDBACK_STATUSES = ["new", "read", "issue", "dropped"] as const;
export const FEEDBACK_TIERS = ["officer", "member"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
