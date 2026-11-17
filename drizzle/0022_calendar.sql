CREATE TABLE "calendar_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"kind" text NOT NULL,
	"variant" text,
	"level" smallint,
	"title" text,
	"notes" text,
	"link" text,
	"day" date NOT NULL,
	"minute" smallint,
	"weekly" boolean DEFAULT false NOT NULL,
	"last_week" date,
	"for_members" boolean DEFAULT false NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"edits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "calendar_entries_kind_check" CHECK ("calendar_entries"."kind" in ('caravan', 'cheese', 'undead', 'elixir', 'kvk', 'duel', 'other')),
	CONSTRAINT "calendar_entries_minute_check" CHECK ("calendar_entries"."minute" between 0 and 1439),
	CONSTRAINT "calendar_entries_time_check" CHECK (("calendar_entries"."minute" is null) = ("calendar_entries"."kind" = 'duel')),
	CONSTRAINT "calendar_entries_level_check" CHECK ("calendar_entries"."level" between 1 and 99),
	CONSTRAINT "calendar_entries_variant_check" CHECK ("calendar_entries"."variant" in ('I', 'II', 'A', 'B'))
);
--> statement-breakpoint
CREATE TABLE "calendar_occurrences" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"entry_id" integer NOT NULL,
	"week" date NOT NULL,
	"day" date,
	"minute" smallint,
	"cancelled" boolean DEFAULT false NOT NULL,
	"coach_uid" bigint,
	"coach_name" text,
	"second_kind" text,
	"second_uid" bigint,
	"second_name" text,
	"rev" integer DEFAULT 0 NOT NULL,
	"edits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "calendar_occurrences_entry_week_unique" UNIQUE("entry_id","week"),
	CONSTRAINT "calendar_occurrences_moved_check" CHECK (("calendar_occurrences"."day" is null) = ("calendar_occurrences"."minute" is null)),
	CONSTRAINT "calendar_occurrences_minute_check" CHECK ("calendar_occurrences"."minute" between 0 and 1439),
	CONSTRAINT "calendar_occurrences_second_check" CHECK (("calendar_occurrences"."second_kind" is null) = ("calendar_occurrences"."second_uid" is null) and ("calendar_occurrences"."second_uid" is null) = ("calendar_occurrences"."second_name" is null) and ("calendar_occurrences"."second_kind" is null or "calendar_occurrences"."second_kind" in ('vip', 'guardian'))),
	CONSTRAINT "calendar_occurrences_coach_check" CHECK (("calendar_occurrences"."coach_uid" is null) = ("calendar_occurrences"."coach_name" is null)),
	CONSTRAINT "calendar_occurrences_two_people_check" CHECK ("calendar_occurrences"."coach_uid" is null or "calendar_occurrences"."second_uid" is null or "calendar_occurrences"."coach_uid" <> "calendar_occurrences"."second_uid")
);
--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_created_by_workspace_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_occurrences" ADD CONSTRAINT "calendar_occurrences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_occurrences" ADD CONSTRAINT "calendar_occurrences_entry_id_calendar_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."calendar_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_entries_workspace_day_idx" ON "calendar_entries" USING btree ("workspace_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_entries_duel_week_unique" ON "calendar_entries" USING btree ("workspace_id","day") WHERE "calendar_entries"."kind" = 'duel';--> statement-breakpoint
CREATE INDEX "calendar_occurrences_workspace_day_idx" ON "calendar_occurrences" USING btree ("workspace_id","day");