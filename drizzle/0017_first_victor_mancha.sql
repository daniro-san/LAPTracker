ALTER TABLE "daily_reads" ADD COLUMN "auto_retry_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_rosters" ADD COLUMN "raw_json" jsonb;