CREATE TABLE "rehearsal_slots" (
	"slot_at" timestamp with time zone PRIMARY KEY NOT NULL,
	"event_id" integer,
	"outcome" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "before_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "after_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "snapshots" ADD COLUMN "quota_remaining_before" integer;--> statement-breakpoint
ALTER TABLE "rehearsal_slots" ADD CONSTRAINT "rehearsal_slots_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;