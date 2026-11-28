CREATE TABLE "roll_call_results" (
	"roll_call_id" integer PRIMARY KEY NOT NULL,
	"opponent" text,
	"our_score" bigint,
	"their_score" bigint,
	"written_by" integer,
	"written_at" timestamp with time zone NOT NULL,
	CONSTRAINT "roll_call_results_scores_check" CHECK (("roll_call_results"."our_score" is null or "roll_call_results"."our_score" >= 0) and ("roll_call_results"."their_score" is null or "roll_call_results"."their_score" >= 0))
);
--> statement-breakpoint
ALTER TABLE "roll_call_marks" DROP CONSTRAINT "roll_call_marks_mark_check";--> statement-breakpoint
ALTER TABLE "roll_call_marks" ADD COLUMN "score" integer;--> statement-breakpoint
ALTER TABLE "roll_call_marks" ADD COLUMN "by_rest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "roll_call_marks" SET "by_rest" = true WHERE "mark" = 'no' AND "roll_call_id" IN (SELECT "id" FROM "roll_calls" WHERE "kind" = 'elixir');--> statement-breakpoint
ALTER TABLE "roll_call_results" ADD CONSTRAINT "roll_call_results_roll_call_id_roll_calls_id_fk" FOREIGN KEY ("roll_call_id") REFERENCES "public"."roll_calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roll_call_results" ADD CONSTRAINT "roll_call_results_written_by_workspace_users_id_fk" FOREIGN KEY ("written_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roll_call_marks" ADD CONSTRAINT "roll_call_marks_score_check" CHECK ("roll_call_marks"."score" is null or "roll_call_marks"."score" >= 0);--> statement-breakpoint
ALTER TABLE "roll_call_marks" ADD CONSTRAINT "roll_call_marks_mark_check" CHECK ("roll_call_marks"."mark" in ('yes', 'no', 'assumed', 'registered', 'early', 'sub', 'excused'));