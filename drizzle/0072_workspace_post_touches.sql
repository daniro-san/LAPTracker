CREATE TABLE "workspace_post_touches" (
	"workspace_id" integer NOT NULL,
	"post_key" text NOT NULL,
	"callout" text NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "workspace_post_touches_workspace_id_post_key_pk" PRIMARY KEY("workspace_id","post_key"),
	CONSTRAINT "workspace_post_touches_post_key_check" CHECK ("workspace_post_touches"."post_key" in ('shield', 'thanks', 'garrison'))
);
--> statement-breakpoint
ALTER TABLE "workspace_post_touches" ADD CONSTRAINT "workspace_post_touches_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_post_touches" ADD CONSTRAINT "workspace_post_touches_updated_by_workspace_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;