CREATE TABLE "notice_publishes" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"notice_id" integer NOT NULL,
	"request_id" text NOT NULL,
	"audience" text NOT NULL,
	"languages" text NOT NULL,
	"status" text NOT NULL,
	"messages" integer DEFAULT 0 NOT NULL,
	"published_by" integer,
	"published_at" timestamp with time zone NOT NULL,
	CONSTRAINT "notice_publishes_audience_check" CHECK ("notice_publishes"."audience" in ('members', 'leaders')),
	CONSTRAINT "notice_publishes_status_check" CHECK ("notice_publishes"."status" in ('posting', 'posted', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD COLUMN "notice_id" integer;--> statement-breakpoint
ALTER TABLE "notice_publishes" ADD CONSTRAINT "notice_publishes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_publishes" ADD CONSTRAINT "notice_publishes_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_publishes" ADD CONSTRAINT "notice_publishes_published_by_workspace_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notice_publishes_request_unique" ON "notice_publishes" USING btree ("workspace_id","request_id");--> statement-breakpoint
CREATE INDEX "notice_publishes_notice_idx" ON "notice_publishes" USING btree ("notice_id","id");--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE set null ON UPDATE no action;