CREATE TABLE "thanks_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"request_id" text NOT NULL,
	"target" text NOT NULL,
	"week" date NOT NULL,
	"texts" jsonb NOT NULL,
	"names" jsonb NOT NULL,
	"status" text NOT NULL,
	"shared_by" integer,
	"shared_at" timestamp with time zone NOT NULL,
	CONSTRAINT "thanks_shares_target_check" CHECK ("thanks_shares"."target" in ('discord', 'board')),
	CONSTRAINT "thanks_shares_status_check" CHECK ("thanks_shares"."status" in ('posting', 'posted', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "thanks_takedowns" (
	"id" serial PRIMARY KEY NOT NULL,
	"share_id" integer NOT NULL,
	"taken_by" integer,
	"taken_at" timestamp with time zone NOT NULL,
	CONSTRAINT "thanks_takedowns_share_id_unique" UNIQUE("share_id")
);
--> statement-breakpoint
ALTER TABLE "thanks_shares" ADD CONSTRAINT "thanks_shares_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thanks_shares" ADD CONSTRAINT "thanks_shares_shared_by_workspace_users_id_fk" FOREIGN KEY ("shared_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thanks_takedowns" ADD CONSTRAINT "thanks_takedowns_share_id_thanks_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."thanks_shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thanks_takedowns" ADD CONSTRAINT "thanks_takedowns_taken_by_workspace_users_id_fk" FOREIGN KEY ("taken_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "thanks_shares_request_unique" ON "thanks_shares" USING btree ("workspace_id","request_id");--> statement-breakpoint
CREATE INDEX "thanks_shares_workspace_idx" ON "thanks_shares" USING btree ("workspace_id","target","id");