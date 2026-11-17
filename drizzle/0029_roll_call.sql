CREATE TABLE "roll_call_marks" (
	"id" serial PRIMARY KEY NOT NULL,
	"roll_call_id" integer NOT NULL,
	"uid" bigint NOT NULL,
	"version" integer NOT NULL,
	"mark" text,
	"written_by" integer,
	"written_at" timestamp with time zone NOT NULL,
	CONSTRAINT "roll_call_marks_version_unique" UNIQUE("roll_call_id","uid","version"),
	CONSTRAINT "roll_call_marks_mark_check" CHECK ("roll_call_marks"."mark" in ('yes', 'no', 'assumed'))
);
--> statement-breakpoint
CREATE TABLE "roll_call_team" (
	"roll_call_id" integer NOT NULL,
	"uid" bigint NOT NULL,
	"name" text NOT NULL,
	"added_by" integer,
	"added_at" timestamp with time zone NOT NULL,
	CONSTRAINT "roll_call_team_roll_call_id_uid_pk" PRIMARY KEY("roll_call_id","uid")
);
--> statement-breakpoint
CREATE TABLE "roll_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"kind" text NOT NULL,
	"variant" text,
	"day" date NOT NULL,
	"week" date NOT NULL,
	"entry_id" integer,
	"request_id" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roll_calls_kind_check" CHECK ("roll_calls"."kind" in ('shield', 'raid', 'plunder', 'elixir')),
	CONSTRAINT "roll_calls_variant_check" CHECK ("roll_calls"."variant" in ('A', 'B'))
);
--> statement-breakpoint
ALTER TABLE "roll_call_marks" ADD CONSTRAINT "roll_call_marks_roll_call_id_roll_calls_id_fk" FOREIGN KEY ("roll_call_id") REFERENCES "public"."roll_calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roll_call_marks" ADD CONSTRAINT "roll_call_marks_written_by_workspace_users_id_fk" FOREIGN KEY ("written_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roll_call_team" ADD CONSTRAINT "roll_call_team_roll_call_id_roll_calls_id_fk" FOREIGN KEY ("roll_call_id") REFERENCES "public"."roll_calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roll_call_team" ADD CONSTRAINT "roll_call_team_added_by_workspace_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roll_calls" ADD CONSTRAINT "roll_calls_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roll_calls" ADD CONSTRAINT "roll_calls_entry_id_calendar_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."calendar_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roll_calls" ADD CONSTRAINT "roll_calls_created_by_workspace_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "roll_calls_workspace_week_idx" ON "roll_calls" USING btree ("workspace_id","week");--> statement-breakpoint
CREATE UNIQUE INDEX "roll_calls_entry_week_unique" ON "roll_calls" USING btree ("entry_id","week");--> statement-breakpoint
CREATE UNIQUE INDEX "roll_calls_request_unique" ON "roll_calls" USING btree ("workspace_id","request_id");