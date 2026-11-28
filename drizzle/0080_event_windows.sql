-- D160: an event has 1 to 4 windows, each with its own Before, After and samples. Every existing event
-- becomes a one-window event: window 1 from its own before_at/after_at, and every existing snapshot row is
-- in window 1 (the column default) and is not between windows. The new unique index is built before the old
-- one is dropped, so one Before and one After per event stays guaranteed throughout.
CREATE TABLE "event_windows" (
	"event_id" integer NOT NULL,
	"n" smallint NOT NULL,
	"before_at" timestamp with time zone NOT NULL,
	"after_at" timestamp with time zone NOT NULL,
	CONSTRAINT "event_windows_pk" PRIMARY KEY("event_id","n"),
	CONSTRAINT "event_windows_n_check" CHECK ("event_windows"."n" between 1 and 4)
);
--> statement-breakpoint
ALTER TABLE "event_windows" ADD CONSTRAINT "event_windows_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "event_windows" ("event_id", "n", "before_at", "after_at") SELECT "id", 1, "before_at", "after_at" FROM "events";--> statement-breakpoint
ALTER TABLE "snapshots" ADD COLUMN "window_n" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "snapshots" ADD COLUMN "between_windows" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_event_window_phase_unique" ON "snapshots" USING btree ("event_id","window_n","phase") WHERE "snapshots"."phase" <> 'sample';--> statement-breakpoint
DROP INDEX "snapshots_event_phase_unique";--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_window_check" CHECK ("snapshots"."window_n" between 1 and 4);--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_between_check" CHECK (not "snapshots"."between_windows" or ("snapshots"."phase" = 'after' or ("snapshots"."phase" = 'before' and "snapshots"."window_n" > 1)));
