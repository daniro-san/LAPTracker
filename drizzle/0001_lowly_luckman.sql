CREATE TABLE "app_errors" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"route" text NOT NULL,
	"digest" text,
	"message" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_start" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_id" integer NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"level" text NOT NULL,
	"code" text NOT NULL,
	"union_id" bigint,
	"data" jsonb NOT NULL,
	CONSTRAINT "run_logs_level_check" CHECK ("run_logs"."level" in ('info', 'warn', 'error'))
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "quota_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "run_logs" ADD CONSTRAINT "run_logs_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_errors_at_idx" ON "app_errors" USING btree ("at");--> statement-breakpoint
CREATE INDEX "run_logs_snapshot_id_idx" ON "run_logs" USING btree ("snapshot_id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_event_at_utc_unique" UNIQUE("event_at_utc");