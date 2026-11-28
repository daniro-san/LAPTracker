CREATE TABLE "kvk_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"entry_id" integer NOT NULL,
	"roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"saved_by" integer,
	"saved_at" timestamp with time zone,
	"notice_id" integer,
	CONSTRAINT "kvk_plans_entry_unique" UNIQUE("entry_id")
);
--> statement-breakpoint
ALTER TABLE "kvk_plans" ADD CONSTRAINT "kvk_plans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kvk_plans" ADD CONSTRAINT "kvk_plans_entry_id_calendar_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."calendar_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kvk_plans" ADD CONSTRAINT "kvk_plans_saved_by_workspace_users_id_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kvk_plans" ADD CONSTRAINT "kvk_plans_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kvk_plans_workspace_idx" ON "kvk_plans" USING btree ("workspace_id");