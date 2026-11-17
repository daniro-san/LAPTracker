CREATE TABLE "member_follow_ups" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"uid" bigint NOT NULL,
	"action" text NOT NULL,
	"note" text,
	"until" text,
	"fact_version" integer,
	"written_by" integer,
	"written_at" timestamp with time zone NOT NULL,
	"request_id" uuid NOT NULL,
	CONSTRAINT "member_follow_ups_request_unique" UNIQUE("workspace_id","request_id"),
	CONSTRAINT "member_follow_ups_action_check" CHECK ("member_follow_ups"."action" in ('talked', 'break', 'help', 'fine', 'withdrawn'))
);
--> statement-breakpoint
ALTER TABLE "member_follow_ups" ADD CONSTRAINT "member_follow_ups_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_follow_ups" ADD CONSTRAINT "member_follow_ups_written_by_workspace_users_id_fk" FOREIGN KEY ("written_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_follow_ups_workspace_uid_idx" ON "member_follow_ups" USING btree ("workspace_id","uid","id");