CREATE TABLE "theft_attackers" (
	"workspace_id" integer NOT NULL,
	"attacker_key" text NOT NULL,
	"server" integer,
	"set_by" integer,
	"set_at" timestamp with time zone NOT NULL,
	CONSTRAINT "theft_attackers_workspace_id_attacker_key_pk" PRIMARY KEY("workspace_id","attacker_key")
);
--> statement-breakpoint
ALTER TABLE "theft_follow_ups" DROP CONSTRAINT "theft_follow_ups_state_check";--> statement-breakpoint
ALTER TABLE "theft_follow_ups" ADD COLUMN "request_id" text;--> statement-breakpoint
ALTER TABLE "thefts" ADD COLUMN "roster_exact" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "thefts" ADD COLUMN "items" text;--> statement-breakpoint
ALTER TABLE "theft_attackers" ADD CONSTRAINT "theft_attackers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theft_attackers" ADD CONSTRAINT "theft_attackers_set_by_workspace_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "theft_follow_ups_request_unique" ON "theft_follow_ups" USING btree ("workspace_id","request_id");--> statement-breakpoint
ALTER TABLE "theft_follow_ups" ADD CONSTRAINT "theft_follow_ups_state_check" CHECK ("theft_follow_ups"."state" in ('open', 'warned', 'talked', 'retaliated', 'resolved'));--> statement-breakpoint
-- D97 (2026-11-19): a typed entry with a uid was picked by an officer from a tracked roster; photo matches stay unknown.
UPDATE "thefts" SET "roster_exact" = true WHERE "source" = 'typed' AND "attacker_uid" IS NOT NULL;