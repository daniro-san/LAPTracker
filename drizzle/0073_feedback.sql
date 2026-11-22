CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"area" text NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"path" text NOT NULL,
	"language" text NOT NULL,
	"workspace_id" integer,
	"tier" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	CONSTRAINT "feedback_area_check" CHECK ("feedback"."area" in ('desk', 'board')),
	CONSTRAINT "feedback_kind_check" CHECK ("feedback"."kind" in ('idea', 'problem', 'good')),
	CONSTRAINT "feedback_status_check" CHECK ("feedback"."status" in ('new', 'read', 'issue', 'dropped')),
	CONSTRAINT "feedback_tier_check" CHECK ("feedback"."tier" in ('officer', 'member')),
	CONSTRAINT "feedback_language_check" CHECK ("feedback"."language" in ('en', 'pt-BR', 'fr'))
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_created_at_idx" ON "feedback" USING btree ("created_at");