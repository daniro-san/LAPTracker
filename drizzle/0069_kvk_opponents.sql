CREATE TABLE "kvk_opponents" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_at" timestamp with time zone NOT NULL,
	"server" integer NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"result" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kvk_opponents_event_at_unique" UNIQUE("event_at"),
	CONSTRAINT "kvk_opponents_server_check" CHECK ("kvk_opponents"."server" between 1 and 9999),
	CONSTRAINT "kvk_opponents_tags_check" CHECK (cardinality("kvk_opponents"."tags") <= 15),
	CONSTRAINT "kvk_opponents_result_check" CHECK ("kvk_opponents"."result" in ('won', 'lost'))
);
--> statement-breakpoint
CREATE TABLE "kvk_reads" (
	"id" serial PRIMARY KEY NOT NULL,
	"opponent_id" integer NOT NULL,
	"snapshot_id" integer NOT NULL,
	"phase" text NOT NULL,
	"tag" text NOT NULL,
	"union_id" bigint,
	"sid" integer,
	"name" text,
	"member_count" integer,
	"total_power" bigint,
	"total_kills" bigint,
	"member_uids" bigint[],
	"member_power" bigint[],
	"member_kills" bigint[],
	"source_updated_at" timestamp with time zone,
	"cached" boolean,
	"is_fresh" boolean NOT NULL,
	"error" text,
	"read_at" timestamp with time zone NOT NULL,
	CONSTRAINT "kvk_reads_opponent_phase_tag_unique" UNIQUE("opponent_id","phase","tag"),
	CONSTRAINT "kvk_reads_phase_check" CHECK ("kvk_reads"."phase" in ('before', 'after'))
);
--> statement-breakpoint
ALTER TABLE "kvk_reads" ADD CONSTRAINT "kvk_reads_opponent_id_kvk_opponents_id_fk" FOREIGN KEY ("opponent_id") REFERENCES "public"."kvk_opponents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kvk_reads" ADD CONSTRAINT "kvk_reads_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE no action ON UPDATE no action;