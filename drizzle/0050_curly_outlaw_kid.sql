CREATE TABLE `project_metric_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`metric_type` text NOT NULL,
	`schedule_interval` text DEFAULT 'manual' NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`last_run_at` text,
	`next_run_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_metric_schedules_project_metric_idx` ON `project_metric_schedules` (`project_id`,`metric_type`);--> statement-breakpoint
CREATE TABLE `project_metric_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`metric_type` text NOT NULL,
	`summary_json` text NOT NULL,
	`captured_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_metric_snapshots_project_metric_idx` ON `project_metric_snapshots` (`project_id`,`metric_type`,`captured_at`);