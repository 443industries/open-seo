CREATE TABLE "project_metric_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"metric_type" text NOT NULL,
	"schedule_interval" text DEFAULT 'manual' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"last_run_at" text,
	"next_run_at" text,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_metric_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"metric_type" text NOT NULL,
	"summary_json" text NOT NULL,
	"captured_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_metric_schedules" ADD CONSTRAINT "project_metric_schedules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_metric_snapshots" ADD CONSTRAINT "project_metric_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_metric_schedules_project_metric_idx" ON "project_metric_schedules" USING btree ("project_id","metric_type");--> statement-breakpoint
CREATE INDEX "project_metric_snapshots_project_metric_idx" ON "project_metric_snapshots" USING btree ("project_id","metric_type","captured_at");