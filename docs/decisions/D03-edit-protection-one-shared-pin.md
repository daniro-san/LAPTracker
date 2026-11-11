## D3 — Edit protection: one shared PIN (2026-11-04, plan §3.3, §12.2)

The only write action exposed to people is "Run snapshot now", gated by `EDIT_PIN` (6–8 digits), compared with `timingSafeEqual` and rate-limited in Postgres (5 per IP per 15 min, 20 global per hour disables PIN auth only). This isn't real auth, and it's proportional to a guild tool whose worst case is a wasted run.
