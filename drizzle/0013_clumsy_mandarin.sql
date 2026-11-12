ALTER TABLE "app_errors" ADD COLUMN "detail" jsonb;--> statement-breakpoint
ALTER TABLE "daily_rosters" ADD COLUMN "error_detail" jsonb;