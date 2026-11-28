CREATE TABLE "raid_opponents" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"saturday" date NOT NULL,
	"server" integer NOT NULL,
	"union_id" bigint NOT NULL,
	"tag" text NOT NULL,
	"name" text,
	"set_by" integer,
	"set_at" timestamp with time zone NOT NULL,
	"cleared_at" timestamp with time zone,
	CONSTRAINT "raid_opponents_server_check" CHECK ("raid_opponents"."server" between 1 and 9999)
);
--> statement-breakpoint
CREATE TABLE "raid_reads" (
	"workspace_id" integer NOT NULL,
	"saturday" date NOT NULL,
	"phase" text NOT NULL,
	"side" text NOT NULL,
	"union_id" bigint NOT NULL,
	"member_count" integer,
	"total_power" bigint,
	"total_kills" bigint,
	"member_uids" bigint[],
	"member_power" bigint[],
	"member_kills" bigint[],
	"source_updated_at" timestamp with time zone,
	"is_fresh" boolean DEFAULT false NOT NULL,
	"error" text,
	"read_at" timestamp with time zone NOT NULL,
	CONSTRAINT "raid_reads_pk" PRIMARY KEY("workspace_id","saturday","phase","side"),
	CONSTRAINT "raid_reads_phase_check" CHECK ("raid_reads"."phase" in ('start', 'end')),
	CONSTRAINT "raid_reads_side_check" CHECK ("raid_reads"."side" in ('us', 'them'))
);
--> statement-breakpoint
ALTER TABLE "shield_settings" ADD COLUMN "raid_start_minute" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shield_settings" ADD COLUMN "raid_end_minute" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "raid_opponents" ADD CONSTRAINT "raid_opponents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raid_opponents" ADD CONSTRAINT "raid_opponents_set_by_workspace_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raid_reads" ADD CONSTRAINT "raid_reads_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "raid_opponents_current_unique" ON "raid_opponents" USING btree ("workspace_id","saturday") WHERE "raid_opponents"."cleared_at" is null;--> statement-breakpoint
ALTER TABLE "shield_settings" ADD CONSTRAINT "shield_settings_raid_start_check" CHECK ("shield_settings"."raid_start_minute" between 0 and 120);--> statement-breakpoint
ALTER TABLE "shield_settings" ADD CONSTRAINT "shield_settings_raid_end_check" CHECK ("shield_settings"."raid_end_minute" between 0 and 120);