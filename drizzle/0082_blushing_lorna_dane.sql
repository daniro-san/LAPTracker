ALTER TABLE "member_follow_ups" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "member_follow_ups" ADD COLUMN "deleted_by" integer;--> statement-breakpoint
ALTER TABLE "member_follow_ups" ADD COLUMN "delete_request_id" text;--> statement-breakpoint
ALTER TABLE "notice_reviews" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notice_reviews" ADD COLUMN "deleted_by" integer;--> statement-breakpoint
ALTER TABLE "notice_reviews" ADD COLUMN "delete_request_id" text;--> statement-breakpoint
ALTER TABLE "member_follow_ups" ADD CONSTRAINT "member_follow_ups_deleted_by_workspace_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_reviews" ADD CONSTRAINT "notice_reviews_deleted_by_workspace_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;