CREATE TABLE "tick_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"outcome" text
);
--> statement-breakpoint
ALTER TABLE "app_alerts" DROP CONSTRAINT "app_alerts_single_row_check";