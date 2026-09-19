CREATE TABLE `local_grid_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tracker_id` text NOT NULL,
	`avg_rank` real,
	`points_found` integer DEFAULT 0 NOT NULL,
	`points_searched` integer DEFAULT 0 NOT NULL,
	`top3_count` integer DEFAULT 0 NOT NULL,
	`top10_count` integer DEFAULT 0 NOT NULL,
	`zoom` integer,
	`grid_json` text NOT NULL,
	`captured_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`tracker_id`) REFERENCES `local_grid_trackers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `local_grid_snapshots_tracker_idx` ON `local_grid_snapshots` (`tracker_id`,`captured_at`);--> statement-breakpoint
CREATE TABLE `local_grid_trackers` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`label` text NOT NULL,
	`keyword` text NOT NULL,
	`target_cid` text,
	`target_place_id` text,
	`target_name` text,
	`center_lat` real NOT NULL,
	`center_lng` real NOT NULL,
	`grid_size` integer DEFAULT 3 NOT NULL,
	`spacing_km` real DEFAULT 2 NOT NULL,
	`device` text DEFAULT 'mobile' NOT NULL,
	`language_code` text DEFAULT 'en' NOT NULL,
	`schedule_interval` text DEFAULT 'weekly' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_run_at` text,
	`next_run_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `local_grid_trackers_project_idx` ON `local_grid_trackers` (`project_id`,`is_active`,`created_at`);