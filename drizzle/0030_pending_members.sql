CREATE TABLE "pending_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"request_id" text,
	"created_by" integer,
	"created_at" timestamp with time zone NOT NULL,
	"matched_uid" bigint,
	"matched_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "pending_members" ADD CONSTRAINT "pending_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_members" ADD CONSTRAINT "pending_members_created_by_workspace_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pending_members_request_unique" ON "pending_members" USING btree ("workspace_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pending_members_open_key_unique" ON "pending_members" USING btree ("workspace_id","name_key") WHERE "pending_members"."matched_uid" is null;