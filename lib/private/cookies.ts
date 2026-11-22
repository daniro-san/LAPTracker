// The workspace's three preference cookies (D73, issue #312), apart from the dictionaries, so a client
// component that writes one does not load every language.
/** Written by the EN · PT · FR switch; read on the server. */
export const WORKSPACE_LANG_COOKIE = "lap_ws_lang";
/** Written when an officer skips or finishes the first-use steps, so they open by themselves once. */
export const WORKSPACE_INTRO_COOKIE = "lap_ws_intro";
/** Written once Follow-up's "How this list works" was shown open, so it opens by itself once (issue 585 S3). */
export const FOLLOW_UP_HELP_COOKIE = "lap_ws_fu_help";
