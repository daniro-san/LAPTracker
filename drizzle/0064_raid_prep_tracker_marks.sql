ALTER TABLE "roll_call_marks" ADD COLUMN "by_tracker" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "roll_calls" ADD COLUMN "tracker_checked_at" timestamp with time zone;