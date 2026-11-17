CREATE TABLE "theft_follow_ups" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"attacker_key" text NOT NULL,
	"state" text NOT NULL,
	"note" text,
	"changed_by" integer,
	"changed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "theft_follow_ups_state_check" CHECK ("theft_follow_ups"."state" in ('open', 'talked', 'resolved'))
);
--> statement-breakpoint
CREATE TABLE "thefts" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"at" timestamp with time zone,
	"attacker_key" text NOT NULL,
	"attacker_uid" bigint,
	"attacker_name" text NOT NULL,
	"attacker_tag" text NOT NULL,
	"stolen" text,
	"victim_uid" bigint,
	"victim_name" text,
	"source" text NOT NULL,
	"note" text,
	"created_by" integer,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "thefts_stolen_check" CHECK ("thefts"."stolen" is null or "thefts"."stolen" = 'quest_rewards'),
	CONSTRAINT "thefts_source_check" CHECK ("thefts"."source" in ('photo', 'typed'))
);
--> statement-breakpoint
ALTER TABLE "theft_follow_ups" ADD CONSTRAINT "theft_follow_ups_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theft_follow_ups" ADD CONSTRAINT "theft_follow_ups_changed_by_workspace_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thefts" ADD CONSTRAINT "thefts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thefts" ADD CONSTRAINT "thefts_created_by_workspace_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "theft_follow_ups_workspace_attacker_idx" ON "theft_follow_ups" USING btree ("workspace_id","attacker_key","id");--> statement-breakpoint
CREATE INDEX "thefts_workspace_attacker_idx" ON "thefts" USING btree ("workspace_id","attacker_key");