CREATE TABLE "workspace_glossary" (
	"workspace_id" integer PRIMARY KEY NOT NULL,
	"words" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_glossary" ADD CONSTRAINT "workspace_glossary_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_glossary" ADD CONSTRAINT "workspace_glossary_updated_by_workspace_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;