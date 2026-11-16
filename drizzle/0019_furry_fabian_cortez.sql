CREATE TABLE "workspace_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"workspace_user_id" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"discord_user_id" text NOT NULL,
	"display_name" text,
	"allowlisted" boolean DEFAULT false NOT NULL,
	"allowlist_added_by" text,
	"allowlist_expires_at" timestamp with time zone,
	"blocked" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "workspace_users_workspace_discord_unique" UNIQUE("workspace_id","discord_user_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"union_id" bigint NOT NULL,
	"discord_guild_id" text NOT NULL,
	"leader_role_ids" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug"),
	CONSTRAINT "workspaces_union_id_unique" UNIQUE("union_id")
);
--> statement-breakpoint
ALTER TABLE "workspace_sessions" ADD CONSTRAINT "workspace_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_sessions" ADD CONSTRAINT "workspace_sessions_workspace_user_id_workspace_users_id_fk" FOREIGN KEY ("workspace_user_id") REFERENCES "public"."workspace_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_users" ADD CONSTRAINT "workspace_users_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_sessions_workspace_idx" ON "workspace_sessions" USING btree ("workspace_id");