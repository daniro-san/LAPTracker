CREATE TABLE "daily_reads" (
	"day" date PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"calls_used" integer DEFAULT 0 NOT NULL,
	"quota_remaining_before" integer,
	"error" text,
	CONSTRAINT "daily_reads_status_check" CHECK ("daily_reads"."status" in ('running', 'complete', 'partial', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "daily_rosters" (
	"id" serial PRIMARY KEY NOT NULL,
	"read_day" date NOT NULL,
	"union_id" bigint NOT NULL,
	"tag" text,
	"name" text,
	"member_count" integer,
	"total_power" bigint,
	"total_kills" bigint,
	"badge_id" integer,
	"source_updated_at" timestamp with time zone,
	"is_fresh" boolean NOT NULL,
	"error" text,
	"member_uids" bigint[] NOT NULL,
	"member_names" text[] NOT NULL,
	"member_power" bigint[] NOT NULL,
	"member_kills" bigint[] NOT NULL,
	CONSTRAINT "daily_rosters_day_union_unique" UNIQUE("read_day","union_id")
);
--> statement-breakpoint
ALTER TABLE "daily_rosters" ADD CONSTRAINT "daily_rosters_read_day_daily_reads_day_fk" FOREIGN KEY ("read_day") REFERENCES "public"."daily_reads"("day") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_rosters_union_idx" ON "daily_rosters" USING btree ("union_id");