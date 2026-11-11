## D10 — Install scripts denied by default (2026-11-04, Session 1)

pnpm 12 fails an install that has unapproved build scripts. `pnpm-workspace.yaml` denies each one explicitly (`allowBuilds: false`): esbuild's postinstall only verifies the platform binary that pnpm already installs as an optional dependency, and lefthook's runs `lefthook install`, which the `prepare` script does. A package added later that needs its install script must get its own entry here.
