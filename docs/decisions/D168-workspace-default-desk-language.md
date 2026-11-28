## D168 — A default desk language per workspace (2026-11-28, issue 438)

Why: issue 438 asks for a default language per workspace. Posts already had one each (D159); the desk followed only the viewer's switch cookie, else the browser's Accept-Language.

**What an officer sets.** Alliance settings → Language: English, Portuguese, French, or "Follow each person's browser" (the default, stored as none). One Save for the card.

**What it does.** The desk language of a request is the switch's cookie, else the workspace's saved language, else Accept-Language, else English (`pickWorkspaceLanguage`). A person's own EN · PT · FR switch always wins. Desk pages under `/w/[slug]` read it through `workspaceWords(slug)`: one small query, only for a viewer with no cookie. API routes keep answering in the cookie or browser language; they carry error words only.

**Access.** `POST /api/w/[slug]/desk-language` needs the officer session of that workspace (`requireWorkspace`); a member or another workspace's officer changes nothing (401). 60 saves per 15 minutes per workspace. The value is one of three language codes, never a roster field.

**Schema.** `workspaces.default_language` (migration 0096), null by default.

**Already done under issue 438 (checked 2026-11-28).** Own tracker key (D124), delete workspace (D125), any alliance (D133), sealed per-workspace webhooks (D129), branding (D167), the glossary per workspace (`glossary` rows keyed by workspace, #846), the bot install link built with the workspace's own server id (`installUrl` in `lib/private/discord-setup.ts`, D129).
