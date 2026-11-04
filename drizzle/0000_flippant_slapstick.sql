CREATE TABLE "alliance_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_id" integer NOT NULL,
	"union_id" bigint NOT NULL,
	"tag" text,
	"name" text,
	"member_count" integer,
	"total_power" bigint,
	"total_kills" bigint,
	"server_rank" integer,
	"level" integer,
	"power_board" bigint,
	"kills_board" bigint,
	"source" text NOT NULL,
	"source_updated_at" timestamp with time zone,
	"cached" boolean,
	"is_fresh" boolean NOT NULL,
	"error" text,
	"raw_json" jsonb,
	CONSTRAINT "alliance_snapshots_snapshot_union_unique" UNIQUE("snapshot_id","union_id"),
	CONSTRAINT "alliance_snapshots_source_check" CHECK ("alliance_snapshots"."source" in ('v1', 'internal'))
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"event_at_utc" timestamp with time zone NOT NULL,
	"alliance_ids" bigint[] NOT NULL,
	"is_test" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"alliance_snapshot_id" integer NOT NULL,
	"uid" bigint NOT NULL,
	"name" text NOT NULL,
	"power" bigint,
	"kills" bigint,
	"lv" integer,
	CONSTRAINT "member_snapshots_alliance_uid_unique" UNIQUE("alliance_snapshot_id","uid")
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"phase" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"calls_used" integer DEFAULT 0 NOT NULL,
	"quota_remaining_after" integer,
	"board_pulled_at" timestamp with time zone,
	"error" text,
	"duration_ms" integer,
	CONSTRAINT "snapshots_event_phase_unique" UNIQUE("event_id","phase"),
	CONSTRAINT "snapshots_phase_check" CHECK ("snapshots"."phase" in ('before', 'after')),
	CONSTRAINT "snapshots_status_check" CHECK ("snapshots"."status" in ('running', 'complete', 'partial', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "alliance_snapshots" ADD CONSTRAINT "alliance_snapshots_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_snapshots" ADD CONSTRAINT "member_snapshots_alliance_snapshot_id_alliance_snapshots_id_fk" FOREIGN KEY ("alliance_snapshot_id") REFERENCES "public"."alliance_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_snapshots_uid_idx" ON "member_snapshots" USING btree ("uid");