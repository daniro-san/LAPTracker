CREATE TABLE "recruit_reads" (
	"workspace_id" integer NOT NULL,
	"day" date NOT NULL,
	"used" integer NOT NULL,
	CONSTRAINT "recruit_reads_pk" PRIMARY KEY("workspace_id","day")
);
--> statement-breakpoint
ALTER TABLE "recruit_reads" ADD CONSTRAINT "recruit_reads_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;