CREATE TABLE "player_history" (
	"union_id" bigint NOT NULL,
	"uid" bigint NOT NULL,
	"t" timestamp with time zone NOT NULL,
	"power" bigint,
	"kills" bigint,
	"level" integer,
	"vip" integer,
	"player_union_id" bigint,
	"union_abbr" text,
	"sid" integer,
	"change_flags" text,
	"nick" text,
	CONSTRAINT "player_history_pk" PRIMARY KEY("union_id","uid","t")
);
--> statement-breakpoint
CREATE TABLE "player_reads" (
	"id" serial PRIMARY KEY NOT NULL,
	"union_id" bigint NOT NULL,
	"uid" bigint NOT NULL,
	"read_at" timestamp with time zone NOT NULL,
	"raw_json" jsonb,
	"shielding" integer,
	"shield_type" integer,
	"map_updated_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"language" text,
	"power" bigint,
	"kills" bigint,
	"player_union_id" bigint,
	"sid" integer,
	"home_sid" integer,
	"vip" integer
);
--> statement-breakpoint
CREATE TABLE "squad_queue" (
	"day" date NOT NULL,
	"union_id" bigint NOT NULL,
	"uid" bigint NOT NULL,
	"state" text DEFAULT 'waiting' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	CONSTRAINT "squad_queue_pk" PRIMARY KEY("day","union_id","uid"),
	CONSTRAINT "squad_queue_state_check" CHECK ("squad_queue"."state" in ('waiting', 'done', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "member_squads" ADD COLUMN "troops" jsonb;--> statement-breakpoint
ALTER TABLE "squad_queue" ADD CONSTRAINT "squad_queue_day_daily_reads_day_fk" FOREIGN KEY ("day") REFERENCES "public"."daily_reads"("day") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_reads_member_idx" ON "player_reads" USING btree ("union_id","uid","read_at");--> statement-breakpoint
CREATE INDEX "player_reads_read_at_idx" ON "player_reads" USING btree ("read_at");--> statement-breakpoint
CREATE INDEX "squad_queue_next_idx" ON "squad_queue" USING btree ("day","union_id","state","due_at");--> statement-breakpoint
ALTER TABLE "squad_reads" DROP COLUMN "after_uid";--> statement-breakpoint
ALTER TABLE "squad_reads" DROP COLUMN "retry_uids";