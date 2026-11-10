# 08zzp — Fan-made disclaimer in the footer

## Built
- `lib/copy.ts`: new key `site.disclaimer`, the sentence from #198 verbatim ("OG's LAP event tracker is a fan-made community project for the Last Asylum Plague game. It is not an official 37Games or Eyu website, and it is not affiliated with Last Asylum Plague. Game names and artwork belong to their owners."). `site.name` is unchanged.
- `app/_ui/SiteFooter.tsx`: one `<p>` under the byline, above the version line. `text-xs`, `text-ink/65` (same colour as the version line, 4.91:1 light and 6.38:1 dark per 08zzo), right-aligned, `max-w-[60ch]`. The footer height is now `min-h-28` / `min-h-36` instead of fixed `h-28` / `h-36`, and on screens below 640 px it has bottom padding (`pb-20` yarn, `pb-28` Granny Doctor) so the corner ornament sits below the wrapped text instead of over it.
- `lib/i18n/*.ts`, `*.stamps.json`: the key translated into all 17 languages with the translate-copy skill, then stamped. "Last Asylum Plague", "37Games", "Eyu" and "OG's LAP event tracker" stay in English in every language.
- `docs/screenshots/08zzp-footer-disclaimer-{360,1280}-{light,dark}.png`: the 404 page, footer visible.

## Decisions
- The key lives in `site` next to `ledger` and `byline`, since the line sits next to them.
- Fixed height replaced with `min-h` because the fixed height would clip the wrapped line at 360 px.
- `id` and `th` were translated by a second Sonnet run: the first Haiku run for those two returned the pt-BR text (it read the `pt-BR` edit another translator had just made in parallel) and edited nothing.

## Deviations
- `SiteFooter` is also rendered by `AdminShell`, so `/admin` shows the line too. The task put /admin out of scope; I did not add a prop to hide it there because the footer is one shared component and /admin already shows the version line from 08zzo. Say if /admin should not carry it.

## Verified
- `pnpm check` exits 0.
- `next dev` with schema-valid placeholder env, no API key, upstream hosts at `127.0.0.1:9`, no database. A 404 page renders the footer without a database. Chrome driven over CDP with an exact viewport and emulated `prefers-color-scheme`. `document.documentElement.scrollWidth` equals the viewport (360 and 1280) in light and dark. The line wraps to four lines at 360 px and does not touch the Granny Doctor.
- Not captured: a page with the yarn ornament (needs a database). Its 64 px height plus 8 px offset fits inside `pb-20` (80 px).
- Spot-check of translations: names kept as in English in all 17; pt-BR/es/fr/de/it read as the English.

## Open issues
- The `translator` agent (Haiku) can copy another language's edit when several run in parallel in one working tree (seen with `id` and `th`). Not changed here.

## Next
Session: none planned in docs/SESSION_PLAYBOOK.md after this change.
Model / effort: keep — a one-line footer change.
Owner must do first: merge this PR into `dev`; decide whether /admin should carry the line (see Deviations).
Plan changes needed: none.

<adjustments>
- #178 (MCP server `instructions` and `openapi.json`) can reuse the English sentence from `en.site.disclaimer` in `lib/copy.ts` instead of a second copy.
</adjustments>
