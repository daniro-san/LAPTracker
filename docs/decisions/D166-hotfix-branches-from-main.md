## D166 — A hotfix branches from `main`, ships as a patch release, and comes back to `dev` (2026-11-28, owner)

**Why.** During the KvK of 2026-11-28 a sample run lost 11 alliances to a hung upstream call (#866). The only way to reach production was a full release from `dev`, which would have shipped every merged change and 16 migrations in the middle of an event. The owner, 2026-11-28: "pra hotfix era só seguir o fluxo padrão de hotfix, faz o código com base na branch que está em prod agora sem levar as alterações de dev".

**Decision.**

1. **When.** An urgent production fix that cannot wait for the next release from `dev`: a bug that loses data, blocks officers or breaks a public page now. Anything that can wait goes through `dev` as usual.
2. **Branch.** `hotfix/<slug>`, cut from `main` (what production runs), never from `dev`. The change is the smallest fix plus its test; no migration unless the fix cannot work without one.
3. **PR into `main`.** Title `release: vX.Y.Z`, where the version is the latest `v*` tag plus a patch bump. The body says it is a hotfix and carries `Closes #N`. The same gates as a release PR apply: `check` green, the ruleset's PR requirement, no `--admin`. The orchestrator merges it with a merge commit (`gh pr merge <n> --merge --match-head-commit <sha>`). Because the merge commit carries `release: vX.Y.Z`, `release-publish` tags it and publishes the GitHub Release, and Vercel deploys `main`.
4. **Back to `dev`, the same day.** A branch `fix/<slug>` cut from `dev` cherry-picks the hotfix commit, and its PR into `dev` is squash-merged like any other. The next release from `dev` then carries no conflict with `main`.
5. **Release notes.** The hotfix gets its own entry in `lib/patch-notes.ts` on the `dev` side, in the back-port PR.

**Amends.** CLAUDE.md's hard rule that `main` changes only through the release-prepare PR (owner, 2026-11-21), and D29: a hotfix PR is the one other way into `main`.
