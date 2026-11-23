CREATE TABLE "feedback_pictures" (
	"feedback_id" integer PRIMARY KEY NOT NULL,
	"workspace_id" integer,
	"data" "bytea" NOT NULL,
	"type" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"hash" text NOT NULL,
	CONSTRAINT "feedback_pictures_type_check" CHECK ("feedback_pictures"."type" in ('image/webp', 'image/jpeg', 'image/png')),
	CONSTRAINT "feedback_pictures_bytes_check" CHECK ("feedback_pictures"."bytes" between 1 and 409600),
	CONSTRAINT "feedback_pictures_side_check" CHECK ("feedback_pictures"."width" between 1 and 1600 and "feedback_pictures"."height" between 1 and 1600),
	CONSTRAINT "feedback_pictures_data_check" CHECK (octet_length("feedback_pictures"."data") between 1 and 409600)
);
--> statement-breakpoint
ALTER TABLE "feedback_pictures" ADD CONSTRAINT "feedback_pictures_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_pictures" ADD CONSTRAINT "feedback_pictures_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;