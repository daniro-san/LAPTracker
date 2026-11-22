CREATE TABLE "member_self_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"uid" bigint NOT NULL,
	"field" text NOT NULL,
	"value" jsonb,
	"version" integer NOT NULL,
	"request_id" text NOT NULL,
	"written_at" timestamp with time zone NOT NULL,
	"seen_version" integer DEFAULT 0 NOT NULL,
	"seen_by" integer,
	"seen_at" timestamp with time zone,
	CONSTRAINT "member_self_reports_user_field_unique" UNIQUE("workspace_id","user_id","field"),
	CONSTRAINT "member_self_reports_field_check" CHECK ("member_self_reports"."field" in ('adTech', 'timeZone', 'languages'))
);
--> statement-breakpoint
ALTER TABLE "member_facts" DROP CONSTRAINT "member_facts_source_check";--> statement-breakpoint
ALTER TABLE "member_self_reports" ADD CONSTRAINT "member_self_reports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_self_reports" ADD CONSTRAINT "member_self_reports_user_id_workspace_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."workspace_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_self_reports" ADD CONSTRAINT "member_self_reports_seen_by_workspace_users_id_fk" FOREIGN KEY ("seen_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_facts" ADD CONSTRAINT "member_facts_source_check" CHECK ("member_facts"."source" in ('message', 'officer', 'sheet', 'tracker', 'member'));