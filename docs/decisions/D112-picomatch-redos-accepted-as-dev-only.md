## D112 — picomatch ReDoS (GHSA-fc5q-39xc-vjpf) accepted as dev-only, dated exception (2026-11-17)

`pnpm audit --audit-level high` fails CI (plan §12.4, D24). On 2026-11-17 a **high** advisory was published for picomatch ≤ 4.0.7: ReDoS through single-branch repeated extglobs. It has **no patched version**, so every PR failed CI on an unrelated change.

- **Where it comes from.** Only dev tooling: `typescript-eslint` → `@typescript-eslint/typescript-estree` → `tinyglobby` (and `fdir`) → `picomatch`, 25 paths, all under linting. `pnpm why picomatch --prod` is empty, so nothing reaches the Next bundle or the server.
- **Why the risk is nil here.** The ReDoS needs an attacker-controlled glob pattern. Ours come from `eslint.config.mjs` and our own file paths, the same reasoning as D24's minimatch entry.
- **Action.** `auditConfig.ignoreGhsas` in `pnpm-workspace.yaml` lists this one GHSA, with a comment pointing here. The other findings still fail CI at high.
- **Resolves** when picomatch publishes a fix and the tooling picks it up through Dependabot's weekly grouped PR. Then drop the `ignoreGhsas` entry. Re-check at the next minor release: `pnpm audit` without the entry.
