CREATE TABLE "alliance_duel_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"uid" bigint NOT NULL,
	"week" date NOT NULL,
	"day" text NOT NULL,
	"points" bigint NOT NULL,
	"saved_by" integer,
	"saved_at" timestamp with time zone NOT NULL,
	CONSTRAINT "alliance_duel_points_unique" UNIQUE("workspace_id","week","day","uid"),
	CONSTRAINT "alliance_duel_points_day_check" CHECK ("alliance_duel_points"."day" in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'week'))
);
--> statement-breakpoint
CREATE TABLE "screenshot_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"kind" text NOT NULL,
	"scope" text,
	"picture_day" date NOT NULL,
	"rows" integer NOT NULL,
	"compared" integer NOT NULL,
	"same" integer NOT NULL,
	"differ" integer NOT NULL,
	"saved_by" integer,
	"saved_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screenshot_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"kind" text NOT NULL,
	"scope" text,
	"scope_sure" boolean NOT NULL,
	"picture_day" date NOT NULL,
	"pages" jsonb NOT NULL,
	"rows" jsonb NOT NULL,
	"left_out" integer DEFAULT 0 NOT NULL,
	"source" text NOT NULL,
	"sent_by" text,
	"status" text DEFAULT 'open' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"done_by" integer,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "screenshot_drafts_status_check" CHECK ("screenshot_drafts"."status" in ('open', 'saved', 'discarded')),
	CONSTRAINT "screenshot_drafts_source_check" CHECK ("screenshot_drafts"."source" in ('desk', 'discord'))
);
--> statement-breakpoint
ALTER TABLE "alliance_duel_points" ADD CONSTRAINT "alliance_duel_points_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliance_duel_points" ADD CONSTRAINT "alliance_duel_points_saved_by_workspace_users_id_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshot_checks" ADD CONSTRAINT "screenshot_checks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshot_checks" ADD CONSTRAINT "screenshot_checks_saved_by_workspace_users_id_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshot_drafts" ADD CONSTRAINT "screenshot_drafts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshot_drafts" ADD CONSTRAINT "screenshot_drafts_done_by_workspace_users_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "screenshot_drafts_workspace_idx" ON "screenshot_drafts" USING btree ("workspace_id","status");