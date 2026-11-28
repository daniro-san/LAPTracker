// The workspace's default desk language for this request (issue 438): one small query on the request's own
// connection, public like the branding (a language is no roster field), so no session is needed.
import { withPageDb } from "@/lib/page";
import { workspaceDefaultLanguage } from "@/lib/private/desk-language";

export const deskDefaultLanguage = (slug: string) =>
  withPageDb((db) => workspaceDefaultLanguage(db, slug));
