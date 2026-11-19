CREATE TABLE "allowance_pauses" (
	"allowance" text PRIMARY KEY NOT NULL,
	"paused_at" timestamp with time zone NOT NULL,
	CONSTRAINT "allowance_pauses_allowance_check" CHECK ("allowance_pauses"."allowance" in ('ai', 'translate'))
);
--> statement-breakpoint
CREATE TABLE "workspace_features" (
	"workspace_id" integer PRIMARY KEY NOT NULL,
	"off" text[] NOT NULL,
	"ai_per_day" integer,
	"translate_per_day" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_features_caps_check" CHECK (coalesce("workspace_features"."ai_per_day", 0) >= 0 and coalesce("workspace_features"."translate_per_day", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "workspace_usage" (
	"workspace_id" integer NOT NULL,
	"allowance" text NOT NULL,
	"day" date NOT NULL,
	"used" integer NOT NULL,
	CONSTRAINT "workspace_usage_pk" PRIMARY KEY("workspace_id","allowance","day"),
	CONSTRAINT "workspace_usage_allowance_check" CHECK ("workspace_usage"."allowance" in ('ai', 'translate'))
);
--> statement-breakpoint
ALTER TABLE "workspace_features" ADD CONSTRAINT "workspace_features_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_usage" ADD CONSTRAINT "workspace_usage_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;