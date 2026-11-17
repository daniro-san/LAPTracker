CREATE TABLE "start_here" (
	"workspace_id" integer PRIMARY KEY NOT NULL,
	"texts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"edits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_sessions" ADD COLUMN "tier" text DEFAULT 'officer' NOT NULL;--> statement-breakpoint
ALTER TABLE "start_here" ADD CONSTRAINT "start_here_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "start_here" ADD CONSTRAINT "start_here_updated_by_workspace_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_sessions" ADD CONSTRAINT "workspace_sessions_tier_check" CHECK ("workspace_sessions"."tier" in ('officer', 'member'));