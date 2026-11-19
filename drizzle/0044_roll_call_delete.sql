DROP INDEX "roll_calls_entry_week_unique";--> statement-breakpoint
DROP INDEX "roll_calls_added_unique";--> statement-breakpoint
ALTER TABLE "roll_calls" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "roll_calls" ADD COLUMN "deleted_by" integer;--> statement-breakpoint
ALTER TABLE "roll_calls" ADD COLUMN "delete_request_id" text;--> statement-breakpoint
ALTER TABLE "roll_calls" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "roll_calls" ADD COLUMN "archived_by" integer;--> statement-breakpoint
ALTER TABLE "roll_calls" ADD CONSTRAINT "roll_calls_deleted_by_workspace_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roll_calls" ADD CONSTRAINT "roll_calls_archived_by_workspace_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "roll_calls_entry_week_unique" ON "roll_calls" USING btree ("entry_id","week") WHERE "roll_calls"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "roll_calls_added_unique" ON "roll_calls" USING btree ("workspace_id","kind","day") WHERE "roll_calls"."request_id" is not null and "roll_calls"."deleted_at" is null;