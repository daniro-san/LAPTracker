ALTER TABLE "notice_pictures" ADD COLUMN "copied_from" integer;--> statement-breakpoint
ALTER TABLE "notice_pictures" ADD COLUMN "kept_by" integer;--> statement-breakpoint
ALTER TABLE "notice_pictures" ADD COLUMN "kept_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notice_pictures" ADD COLUMN "warned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notice_pictures" ADD CONSTRAINT "notice_pictures_copied_from_notices_id_fk" FOREIGN KEY ("copied_from") REFERENCES "public"."notices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_pictures" ADD CONSTRAINT "notice_pictures_kept_by_workspace_users_id_fk" FOREIGN KEY ("kept_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_pictures" ADD CONSTRAINT "notice_pictures_data_check" CHECK (octet_length("notice_pictures"."data") between 1 and 409600);