CREATE TABLE "player_frames" (
	"uid" bigint PRIMARY KEY NOT NULL,
	"frame_id" integer NOT NULL,
	"seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
-- D65: start from the newest frame already stored on an event row.
INSERT INTO "player_frames" ("uid", "frame_id", "seen_at")
SELECT DISTINCT ON (m."uid") m."uid", m."frame_id", a."source_updated_at"
FROM "member_snapshots" m
JOIN "alliance_snapshots" a ON a."id" = m."alliance_snapshot_id"
WHERE m."frame_id" IS NOT NULL AND a."source_updated_at" IS NOT NULL
ORDER BY m."uid", a."source_updated_at" DESC;
