CREATE TABLE "kvk_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_at" timestamp with time zone NOT NULL,
	"server" integer NOT NULL,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"alliances" jsonb,
	"pulled_at" timestamp with time zone,
	"claimed_at" timestamp with time zone NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "kvk_suggestions_event_at_server_unique" UNIQUE("event_at","server"),
	CONSTRAINT "kvk_suggestions_server_check" CHECK ("kvk_suggestions"."server" between 1 and 9999),
	CONSTRAINT "kvk_suggestions_status_check" CHECK ("kvk_suggestions"."status" in ('running', 'read', 'failed')),
	CONSTRAINT "kvk_suggestions_attempts_check" CHECK ("kvk_suggestions"."attempts" between 1 and 3),
	CONSTRAINT "kvk_suggestions_alliances_check" CHECK ("kvk_suggestions"."alliances" is null or jsonb_array_length("kvk_suggestions"."alliances") <= 15)
);
