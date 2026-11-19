CREATE TABLE "garrison_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"entry_id" integer NOT NULL,
	"week" date NOT NULL,
	"pairs" jsonb NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"saved_by" integer,
	"saved_at" timestamp with time zone NOT NULL,
	"post_request_id" text,
	"post_status" text,
	"posted_by" integer,
	"posted_at" timestamp with time zone,
	CONSTRAINT "garrison_plans_entry_week_unique" UNIQUE("entry_id","week"),
	CONSTRAINT "garrison_plans_post_status_check" CHECK ("garrison_plans"."post_status" in ('posting', 'posted', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD COLUMN "enemy_might" bigint;--> statement-breakpoint
ALTER TABLE "garrison_plans" ADD CONSTRAINT "garrison_plans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garrison_plans" ADD CONSTRAINT "garrison_plans_entry_id_calendar_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."calendar_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garrison_plans" ADD CONSTRAINT "garrison_plans_saved_by_workspace_users_id_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garrison_plans" ADD CONSTRAINT "garrison_plans_posted_by_workspace_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "garrison_plans_workspace_idx" ON "garrison_plans" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_enemy_might_check" CHECK ("calendar_entries"."enemy_might" is null or ("calendar_entries"."kind" = 'undead' and "calendar_entries"."enemy_might" > 0));