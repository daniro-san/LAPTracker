ALTER TABLE "run_logs" ALTER COLUMN "snapshot_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "run_logs" ADD COLUMN "read_day" date;--> statement-breakpoint
ALTER TABLE "run_logs" ADD CONSTRAINT "run_logs_read_day_daily_reads_day_fk" FOREIGN KEY ("read_day") REFERENCES "public"."daily_reads"("day") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "run_logs_read_day_idx" ON "run_logs" USING btree ("read_day");--> statement-breakpoint
ALTER TABLE "run_logs" ADD CONSTRAINT "run_logs_one_owner_check" CHECK (("run_logs"."snapshot_id" is null) <> ("run_logs"."read_day" is null));