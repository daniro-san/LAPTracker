CREATE TABLE "app_alerts" (
	"id" integer PRIMARY KEY NOT NULL,
	"alerted_at" timestamp with time zone NOT NULL,
	CONSTRAINT "app_alerts_single_row_check" CHECK ("app_alerts"."id" = 1)
);
