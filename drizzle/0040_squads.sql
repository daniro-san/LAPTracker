CREATE TABLE "hero_catalog" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_squads" (
	"id" serial PRIMARY KEY NOT NULL,
	"union_id" bigint NOT NULL,
	"uid" bigint NOT NULL,
	"squad" integer NOT NULL,
	"power" bigint NOT NULL,
	"soldiers" bigint,
	"soldier_load" bigint,
	"heroes" jsonb NOT NULL,
	"seen_at" timestamp with time zone,
	"read_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "squad_reads" (
	"day" date PRIMARY KEY NOT NULL,
	"union_id" bigint NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"batch_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"members" integer NOT NULL,
	"after_uid" bigint,
	"calls_used" integer DEFAULT 0 NOT NULL,
	"with_squads" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"quota_remaining" integer,
	"reason" text,
	CONSTRAINT "squad_reads_status_check" CHECK ("squad_reads"."status" in ('running', 'done', 'stopped', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "member_facts" DROP CONSTRAINT "member_facts_source_check";--> statement-breakpoint
ALTER TABLE "squad_reads" ADD CONSTRAINT "squad_reads_day_daily_reads_day_fk" FOREIGN KEY ("day") REFERENCES "public"."daily_reads"("day") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_squads_member_idx" ON "member_squads" USING btree ("union_id","uid","squad");--> statement-breakpoint
ALTER TABLE "member_facts" ADD CONSTRAINT "member_facts_source_check" CHECK ("member_facts"."source" in ('message', 'officer', 'sheet', 'tracker'));