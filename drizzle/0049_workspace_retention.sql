CREATE TABLE "workspace_data_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"action" text NOT NULL,
	"by" integer,
	"at" timestamp with time zone NOT NULL,
	"request_id" text NOT NULL,
	CONSTRAINT "workspace_data_events_action_check" CHECK ("workspace_data_events"."action" in ('download', 'delete_asked', 'delete_cancelled'))
);
--> statement-breakpoint
CREATE TABLE "workspace_tombstones" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"union_id" bigint NOT NULL,
	"alliance" text,
	"requested_by" text,
	"by_owner" boolean NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"purged_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "deletion_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "deletion_requested_by" integer;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "purge_after" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspace_data_events" ADD CONSTRAINT "workspace_data_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_data_events" ADD CONSTRAINT "workspace_data_events_by_workspace_users_id_fk" FOREIGN KEY ("by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_data_events_request_unique" ON "workspace_data_events" USING btree ("workspace_id","request_id");--> statement-breakpoint
CREATE INDEX "workspace_data_events_workspace_at_idx" ON "workspace_data_events" USING btree ("workspace_id","at");