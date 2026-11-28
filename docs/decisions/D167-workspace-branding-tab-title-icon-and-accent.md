## D167 — Workspace branding: the tab title, one of three icons and one of six colours, and the same name and icon on webhook posts (2026-11-28, owner scope 2026-11-19 and 2026-11-20, issue 462; amends D22, D110)

Why: an alliance wants its desk to look like its own. The owner kept it small: three things, set by officers in Alliance settings → Branding, and nothing else.

**What an officer sets (one Save for the card).**

- **Tab title.** Default `[TAG] Desk`, from the alliance's own tag (`Officers’ Desk` while it has none). At most 40 characters, plain text: one line, no angle brackets, no control or hidden characters (`cleanTitle`, which reuses the callout cleaner). Left empty, or typed as the default, it is stored as none and follows the tag.
- **Icon, one of three.** The alliance badge (default; `alliances.badge_id`, no setup), the Discord server's icon, or the desk mark. No uploads.
- **Accent colour, one of six.** `burgundy` (the default, the header it always had), `indigo`, `teal`, `forest`, `umber`, `slate`. Never a free hex. Each is a `--burgundy` override in `lib/brand/tokens.css` (`[data-accent]`) and keeps the header's wax-paper text at 4.5:1 or more in light and dark (`lib/workspace-branding.test.ts`). It changes the header band only.

**Where it shows.**

- The page's metadata title and icon (`/w/[slug]` layout), the header band's colour (`data-accent` on the layout's wrapper) and a 32 px icon beside the desk's name.
- The per-workspace manifest (D110): `name` and `short_name` are the title, `icons` the chosen icon, `theme_color` the accent (plum for the default accent, as before). `id`, `start_url`, `scope` and the share target are unchanged.
- Once an officer has saved a title or an icon, every webhook message the workspace posts (notices, thanks, garrison, catalog posts, the welcome post, the `/join` note, the Raid Shield summary, the test message) goes out with Discord's per-message `username` (the title) and `avatar_url` (the icon). A workspace that never saved Branding posts exactly as before: no `username` or `avatar_url`, so each webhook keeps the name and avatar its server gave it (the tab title and the manifest still default to `[TAG] Desk`). A name Discord refuses (it contains "clyde" or "discord", or is over 80 code points) is left out, never cut, and the webhook's own name stays. The bot's own profile is not changed. The avatar needs our own address: the request's origin on the desk's routes, and the tick's for the Raid Shield summary. A post sent from the daily catalog job or the welcome post has no request address, so it carries the name only until a site address setting exists (open point).
- "LAP Tracker" stays in the footer.

**The Discord server's icon.** The bot reads the guild's `icon` hash (`GET /guilds/{id}`) when an officer saves that choice, and again on every "Check" in the Discord card, and keeps it in `workspaces.discord_icon_hash`. Choosing it with no readable icon (no bot, none set) is refused with `no_discord_icon`. `/img/desk/[slug]?size=192|512&v=<choice>-<id or hash>` (the version changes with the icon, so a cached copy is never reused) fetches `https://cdn.discordapp.com/icons/<guild>/<hash>.png` (256 or 512 px, a power of two, downscaled to the size asked) on the server (redirects refused, size cap and raster types as for every image, D22) and serves the bytes. It never redirects to Discord, so a viewer and Discord's avatar fetch reach our origin only. The route also serves the badge at those sizes (the tracker site's preset, as `/img/badge/[id]`), because an installed app needs 192 and 512 px; the desk mark is the site's own `/icon/<size>`.

**Access.** Public to read (a title, an icon choice and a colour id, no roster field), officers only to write: `POST /api/w/[slug]/branding` needs the officer session of that workspace (`requireWorkspace`), so another workspace's officer, a member or no session changes nothing (401). Saves are limited to 60 per 15 minutes per workspace.

**Schema.** `workspaces.brand_title`, `brand_icon`, `brand_accent`, `discord_icon_hash` (migration 0095), all null by default.

**Amends.** D22: `/img/desk/[slug]` also fetches `cdn.discordapp.com`, only for the icon hash the bot read for that workspace's own server, never a URL from a request. D110: the manifest's name, icons and theme colour come from the branding.

**Open points.** A site address setting so the catalog job's and the welcome post's webhook messages carry the avatar too; the board's page titles and the members' board keep their own words (out of scope: renaming words and the board's title).
