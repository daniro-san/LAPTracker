## D2 — Persistence: Neon Postgres + Drizzle, keep everything forever (2026-11-04, plan §3.2)

Permanent history is a requirement. Neon's free tier scales to zero and keeps data. Supabase's free tier pauses after ~7 days idle, which is a real risk for a once-a-week app. SQLite is out because Vercel's filesystem is ephemeral, and KV/Blob don't fit relational row edits. Raw upstream responses (trimmed of bulk and free text) are stored in `raw_json` so formulas can be recomputed without spending quota. Volume is ~15–45 MB/year against Neon's 1 GB.
