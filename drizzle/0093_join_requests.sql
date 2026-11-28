CREATE TABLE "join_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"discord_user_id" text NOT NULL,
	"discord_name" text NOT NULL,
	"typed" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "join_requests_workspace_user_unique" UNIQUE("workspace_id","discord_user_id")
);
--> statement-breakpoint
ALTER TABLE "workspace_users" ADD COLUMN "welcomed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspace_discord" ADD COLUMN "member_role_id" text;--> statement-breakpoint
ALTER TABLE "workspace_discord" ADD COLUMN "member_role_name" text;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "join_requests_created_at_idx" ON "join_requests" USING btree ("created_at");