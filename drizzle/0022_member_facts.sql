CREATE TABLE "member_facts" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"uid" bigint NOT NULL,
	"field" text NOT NULL,
	"version" integer NOT NULL,
	"value" jsonb,
	"source" text NOT NULL,
	"written_by" integer,
	"written_at" timestamp with time zone NOT NULL,
	CONSTRAINT "member_facts_version_unique" UNIQUE("workspace_id","uid","field","version"),
	CONSTRAINT "member_facts_source_check" CHECK ("member_facts"."source" in ('message', 'officer', 'sheet'))
);
--> statement-breakpoint
CREATE TABLE "name_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"name_key" text NOT NULL,
	"uid" bigint,
	"confirmed_by" integer,
	"confirmed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "name_aliases_workspace_key_unique" UNIQUE("workspace_id","name_key")
);
--> statement-breakpoint
ALTER TABLE "member_facts" ADD CONSTRAINT "member_facts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_facts" ADD CONSTRAINT "member_facts_written_by_workspace_users_id_fk" FOREIGN KEY ("written_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "name_aliases" ADD CONSTRAINT "name_aliases_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "name_aliases" ADD CONSTRAINT "name_aliases_confirmed_by_workspace_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."workspace_users"("id") ON DELETE set null ON UPDATE no action;