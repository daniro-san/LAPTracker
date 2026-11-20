CREATE TABLE "shield_checks" (
	"day" date NOT NULL,
	"union_id" bigint NOT NULL,
	"night_at" timestamp with time zone,
	"morning_status" text,
	"morning_started_at" timestamp with time zone,
	"morning_batch_at" timestamp with time zone,
	"morning_finished_at" timestamp with time zone,
	"morning_calls" integer DEFAULT 0 NOT NULL,
	"morning_quota_remaining" integer,
	"morning_reason" text,
	"message_id" text,
	"posted_at" timestamp with time zone,
	CONSTRAINT "shield_checks_pk" PRIMARY KEY("day","union_id"),
	CONSTRAINT "shield_checks_morning_status_check" CHECK ("shield_checks"."morning_status" in ('running', 'done', 'stopped', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "shield_queue" (
	"day" date NOT NULL,
	"union_id" bigint NOT NULL,
	"uid" bigint NOT NULL,
	"state" text DEFAULT 'waiting' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	CONSTRAINT "shield_queue_pk" PRIMARY KEY("day","union_id","uid"),
	CONSTRAINT "shield_queue_state_check" CHECK ("shield_queue"."state" in ('waiting', 'done', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "shield_settings" (
	"workspace_id" integer PRIMARY KEY NOT NULL,
	"morning_minute" integer DEFAULT 600 NOT NULL,
	"discord" boolean DEFAULT false NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "shield_settings_minute_check" CHECK ("shield_settings"."morning_minute" between 600 and 660),
	CONSTRAINT "shield_settings_language_check" CHECK ("shield_settings"."language" in ('en', 'pt-BR', 'fr'))
);
--> statement-breakpoint
ALTER TABLE "roll_call_marks" DROP CONSTRAINT "roll_call_marks_version_unique";--> statement-breakpoint
ALTER TABLE "roll_call_marks" ADD COLUMN "part" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "shield_checks" ADD CONSTRAINT "shield_checks_day_daily_reads_day_fk" FOREIGN KEY ("day") REFERENCES "public"."daily_reads"("day") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shield_queue" ADD CONSTRAINT "shield_queue_day_daily_reads_day_fk" FOREIGN KEY ("day") REFERENCES "public"."daily_reads"("day") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shield_settings" ADD CONSTRAINT "shield_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shield_settings" ADD CONSTRAINT "shield_settings_updated_by_workspace_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shield_queue_next_idx" ON "shield_queue" USING btree ("day","union_id","state","due_at");--> statement-breakpoint
ALTER TABLE "roll_call_marks" ADD CONSTRAINT "roll_call_marks_version_unique" UNIQUE("roll_call_id","uid","part","version");--> statement-breakpoint
ALTER TABLE "roll_call_marks" ADD CONSTRAINT "roll_call_marks_part_check" CHECK ("roll_call_marks"."part" in ('main', 'wall'));