// Home's "Recent activity" list state (D108, 2026-11-18): the first page from the server, the pages "Show
// more" added after it, and the cursor of the next one. "Show less" goes back to the first page and its
// cursor, so the next "Show more" reads the same second page again.
import type { ActivityPageView, ActivityView } from "@/lib/private/desk-activity-words";

export interface ActivityList {
  first: ActivityView[];
  firstNext: number | null;
  more: ActivityView[];
  next: number | null;
}

export const listOf = (page: ActivityPageView): ActivityList => ({
  first: page.lines,
  firstNext: page.next,
  more: [],
  next: page.next,
});

export const withPage = (list: ActivityList, page: ActivityPageView): ActivityList => ({
  ...list,
  more: [...list.more, ...page.lines],
  next: page.next,
});

export const collapsed = (list: ActivityList): ActivityList => ({
  ...list,
  more: [],
  next: list.firstNext,
});
