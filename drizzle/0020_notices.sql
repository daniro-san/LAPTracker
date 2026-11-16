CREATE TABLE "notice_edits" (
	"id" serial PRIMARY KEY NOT NULL,
	"notice_id" integer NOT NULL,
	"workspace_id" integer NOT NULL,
	"field" text NOT NULL,
	"value" text NOT NULL,
	"basis" integer,
	"edited_by" integer,
	"edited_at" timestamp with time zone NOT NULL,
	CONSTRAINT "notice_edits_field_check" CHECK ("notice_edits"."field" in ('title', 'en', 'pt-BR', 'fr', 'for_members', 'ends_on'))
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notice_edits" ADD CONSTRAINT "notice_edits_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_edits" ADD CONSTRAINT "notice_edits_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_edits" ADD CONSTRAINT "notice_edits_edited_by_workspace_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_created_by_workspace_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_updated_by_workspace_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notice_edits_notice_field_idx" ON "notice_edits" USING btree ("notice_id","field","id");--> statement-breakpoint
CREATE INDEX "notices_workspace_idx" ON "notices" USING btree ("workspace_id");