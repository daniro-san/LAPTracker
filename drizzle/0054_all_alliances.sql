CREATE TABLE "alliance_board" (
	"day" date NOT NULL,
	"union_id" bigint NOT NULL,
	"tag" text,
	"name" text,
	"badge_id" integer,
	"power" bigint,
	"power_rank" integer,
	"kills" bigint,
	"kills_rank" integer,
	"pulled_at" timestamp with time zone NOT NULL,
	CONSTRAINT "alliance_board_day_union_id_pk" PRIMARY KEY("day","union_id")
);
--> statement-breakpoint
CREATE TABLE "alliance_lookups" (
	"union_id" bigint NOT NULL,
	"day" date NOT NULL,
	"claimed_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"calls_used" integer DEFAULT 0 NOT NULL,
	"quota_remaining" integer,
	"error" text,
	CONSTRAINT "alliance_lookups_union_id_day_pk" PRIMARY KEY("union_id","day"),
	CONSTRAINT "alliance_lookups_status_check" CHECK ("alliance_lookups"."status" in ('running', 'done', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "alliances" (
	"union_id" bigint PRIMARY KEY NOT NULL,
	"tag" text,
	"name" text,
	"badge_id" integer,
	"first_seen_day" date NOT NULL,
	"last_seen_day" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracked_sets" (
	"day" date PRIMARY KEY NOT NULL,
	"alliance_ids" bigint[] NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "tracked_sets_source_check" CHECK ("tracked_sets"."source" in ('board', 'previous', 'event'))
);
--> statement-breakpoint
ALTER TABLE "daily_rosters" DROP CONSTRAINT "daily_rosters_read_day_daily_reads_day_fk";
--> statement-breakpoint
CREATE INDEX "alliance_board_union_idx" ON "alliance_board" USING btree ("union_id");--> statement-breakpoint
CREATE INDEX "alliance_lookups_day_idx" ON "alliance_lookups" USING btree ("day");