CREATE TABLE "notice_pictures" (
	"notice_id" integer PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"type" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"hash" text NOT NULL,
	"added_by" integer,
	"added_at" timestamp with time zone NOT NULL,
	CONSTRAINT "notice_pictures_type_check" CHECK ("notice_pictures"."type" in ('image/webp', 'image/jpeg', 'image/png')),
	CONSTRAINT "notice_pictures_bytes_check" CHECK ("notice_pictures"."bytes" between 1 and 409600),
	CONSTRAINT "notice_pictures_side_check" CHECK ("notice_pictures"."width" between 1 and 1600 and "notice_pictures"."height" between 1 and 1600)
);
--> statement-breakpoint
ALTER TABLE "notice_pictures" ADD CONSTRAINT "notice_pictures_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_pictures" ADD CONSTRAINT "notice_pictures_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_pictures" ADD CONSTRAINT "notice_pictures_added_by_workspace_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notice_pictures_workspace_added_idx" ON "notice_pictures" USING btree ("workspace_id","added_at");