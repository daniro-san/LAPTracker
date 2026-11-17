ALTER TABLE "workspace_sessions" ADD COLUMN "seen_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "member_facts_workspace_written_idx" ON "member_facts" USING btree ("workspace_id","written_at");--> statement-breakpoint
CREATE INDEX "member_follow_ups_workspace_written_idx" ON "member_follow_ups" USING btree ("workspace_id","written_at");--> statement-breakpoint
CREATE INDEX "roll_call_marks_written_idx" ON "roll_call_marks" USING btree ("written_at");--> statement-breakpoint
CREATE INDEX "notice_edits_workspace_edited_idx" ON "notice_edits" USING btree ("workspace_id","edited_at");--> statement-breakpoint
CREATE INDEX "thefts_workspace_created_idx" ON "thefts" USING btree ("workspace_id","created_at");