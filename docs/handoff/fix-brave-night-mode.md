# fix/brave-night-mode

## Built
- `app/layout.tsx`: `generateMetadata` returns `other: { "darkreader-lock": "true" }`, so every page's head has `<meta name="darkreader-lock" content="true">`.
- `app/layout.test.ts`: one test that the metadata carries the lock. It fails without the change (`other` is undefined).
- `docs/DESIGN.md` (theme paragraph): one sentence recording the lock, dated 2026-11-22. No decision file covers themes, so there was nothing to amend.

## Decisions
- Used `darkreader-lock` only. Sources:
  - Brave's Night Mode is Dark Reader based. A Brave maintainer says in darkreader/darkreader#15016 "this is the library we use to power night mode"; another says Brave uses the injected build, not the full extension (quoted via https://community.brave.app/t/dark-mode-not-working-on-some-websites/649203). Brave iOS issue: brave/brave-browser#52745.
  - Dark Reader documents the opt-out in CONTRIBUTING.md, "Disabling Dark Reader on your site": `<meta name="darkreader-lock">` in `<head>` (https://github.com/darkreader/darkreader/blob/main/CONTRIBUTING.md). Its changelog also lists lock-tag handling fixes.
- Not added: `<meta name="color-scheme">`. I found no Dark Reader or Brave source that treats it as an opt-out, and `light dark` could invite recolouring. CSS `color-scheme` is already set per theme in tokens.css and globals.css.
- Content is `"true"`, not `""`: Next drops a meta tag whose content is empty (`node_modules/next/dist/lib/metadata/metadata-elements.js`, "Other" section). Dark Reader reads only the name.
- The theme cookie, ThemeSwitch and `prefers-color-scheme` are untouched.

## Deviations
- None.

## Verified
- `pnpm vitest related --run app/layout.tsx app/layout.test.ts`: passes.
- `pnpm check`: see PR.
- Not verified in Brave: no Brave iOS is available here. I found no source confirming that Brave's bundled Dark Reader build honours the lock tag (a Dark Reader bug, #12809, said the tag broke in v4.9.86). The owner checks on the phone.

## Open issues
- If Brave ignores the lock tag, the next options are a Brave issue, or telling users to turn Night Mode off for the site. I did not research further.

## Next
- Owner opens the site in Brave iOS with Night Mode on, light theme, and reports whether the page stays cream.
- If it still recolours, file it against brave/brave-browser with #52745 as the reference.

What was missing from the task prompt? Nothing material.

PR: (added by the orchestrator)
