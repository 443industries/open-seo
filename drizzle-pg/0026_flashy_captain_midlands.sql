CREATE TABLE "local_grid_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"tracker_id" text NOT NULL,
	"avg_rank" real,
	"points_found" integer DEFAULT 0 NOT NULL,
	"points_searched" integer DEFAULT 0 NOT NULL,
	"top3_count" integer DEFAULT 0 NOT NULL,
	"top10_count" integer DEFAULT 0 NOT NULL,
	"zoom" integer,
	"grid_json" text NOT NULL,
	"captured_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "local_grid_trackers" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"label" text NOT NULL,
	"keyword" text NOT NULL,
	"target_cid" text,
	"target_place_id" text,
	"target_name" text,
	"center_lat" real NOT NULL,
	"center_lng" real NOT NULL,
	"grid_size" integer DEFAULT 3 NOT NULL,
	"spacing_km" real DEFAULT 2 NOT NULL,
	"device" text DEFAULT 'mobile' NOT NULL,
	"language_code" text DEFAULT 'en' NOT NULL,
	"schedule_interval" text DEFAULT 'weekly' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_run_at" text,
	"next_run_at" text,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "local_grid_snapshots" ADD CONSTRAINT "local_grid_snapshots_tracker_id_local_grid_trackers_id_fk" FOREIGN KEY ("tracker_id") REFERENCES "public"."local_grid_trackers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_grid_trackers" ADD CONSTRAINT "local_grid_trackers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "local_grid_snapshots_tracker_idx" ON "local_grid_snapshots" USING btree ("tracker_id","captured_at");--> statement-breakpoint
CREATE INDEX "local_grid_trackers_project_idx" ON "local_grid_trackers" USING btree ("project_id","is_active","created_at");