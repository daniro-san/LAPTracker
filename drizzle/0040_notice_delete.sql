ALTER TABLE "notices" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "deleted_by" integer;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "delete_request_id" text;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_deleted_by_workspace_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;