## D12 — gitleaks: `gitleaks git --pre-commit --staged`, plus a lap_ rule (2026-11-04, Session 1)

`gitleaks protect` is hidden/deprecated in v8.30 in favour of `gitleaks git --pre-commit --staged`, which is what lefthook runs. The default rules don't know the LAP key format, so `.gitleaks.toml` extends them with `lap_[A-Za-z0-9]{20,}`. Placeholders (`lap_...`, `lap_cloud-placeholder`) don't match.
