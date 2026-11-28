ALTER TABLE "daily_reads" ADD COLUMN "target_ids" bigint[];--> statement-breakpoint
ALTER TABLE "daily_rosters" ADD COLUMN "stored_at" timestamp with time zone;