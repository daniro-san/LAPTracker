CREATE TABLE "notice_review_outcomes" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"review_id" integer NOT NULL,
	"request_id" text NOT NULL,
	"outcome" text NOT NULL,
	"by" integer,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "notice_review_outcomes_outcome_check" CHECK ("notice_review_outcomes"."outcome" in ('approved', 'edited'))
);
--> statement-breakpoint
CREATE TABLE "notice_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"notice_id" integer NOT NULL,
	"request_id" text NOT NULL,
	"language" text,
	"reviewer_id" integer,
	"asked_by" integer,
	"asked_at" timestamp with time zone NOT NULL,
	CONSTRAINT "notice_reviews_language_check" CHECK ("notice_reviews"."language" in ('en', 'pt-BR', 'fr'))
);
--> statement-breakpoint
ALTER TABLE "notice_review_outcomes" ADD CONSTRAINT "notice_review_outcomes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_review_outcomes" ADD CONSTRAINT "notice_review_outcomes_review_id_notice_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."notice_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_review_outcomes" ADD CONSTRAINT "notice_review_outcomes_by_workspace_users_id_fk" FOREIGN KEY ("by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_reviews" ADD CONSTRAINT "notice_reviews_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_reviews" ADD CONSTRAINT "notice_reviews_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_reviews" ADD CONSTRAINT "notice_reviews_reviewer_id_workspace_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_reviews" ADD CONSTRAINT "notice_reviews_asked_by_workspace_users_id_fk" FOREIGN KEY ("asked_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notice_review_outcomes_review_unique" ON "notice_review_outcomes" USING btree ("review_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notice_review_outcomes_request_unique" ON "notice_review_outcomes" USING btree ("workspace_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notice_reviews_request_unique" ON "notice_reviews" USING btree ("workspace_id","request_id");--> statement-breakpoint
CREATE INDEX "notice_reviews_notice_idx" ON "notice_reviews" USING btree ("notice_id","id");