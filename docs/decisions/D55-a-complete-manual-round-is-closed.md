## D55 — A complete manual round is closed (2026-11-06, owner, 08zzg)

Amends issue 157's round card. Once both phases of a manual round are done, /admin shows it as one collapsed line (its name, "Round complete", ▾) that opens to its phases, facts and "Open on the site", read-only: no "Record again", no "Change options". To record again, the owner starts a new manual round. While a round is still running, "Record again" on a done phase and "Change options" stay as before.

- **UI only.** The manual-snapshot route still accepts `force` on a complete phase (D28); the page just no longer offers it for a complete round.
