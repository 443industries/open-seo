import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { projects } from "./app.schema";

// ---------------------------------------------------------------------------
// Local Map Rank Tracker — persisted local rank grids tracked over time. One
// tracker = one keyword + target business + storefront-centered grid; each run
// stores a snapshot so Avg Rank / coverage / share trend can be charted. Mirror
// of the rank-tracking config+snapshot pattern for the local map pack.
// ---------------------------------------------------------------------------
export const localGridTrackers = sqliteTable(
  "local_grid_trackers",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    keyword: text("keyword").notNull(),
    // Target business identifiers (at least one set; cid is most reliable).
    targetCid: text("target_cid"),
    targetPlaceId: text("target_place_id"),
    targetName: text("target_name"),
    centerLat: real("center_lat").notNull(),
    centerLng: real("center_lng").notNull(),
    gridSize: integer("grid_size").notNull().default(3),
    spacingKm: real("spacing_km").notNull().default(2),
    device: text("device", { enum: ["desktop", "mobile"] })
      .notNull()
      .default("mobile"),
    languageCode: text("language_code").notNull().default("en"),
    scheduleInterval: text("schedule_interval", {
      enum: ["daily", "weekly", "monthly", "manual"],
    })
      .notNull()
      .default("weekly"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    lastRunAt: text("last_run_at"),
    nextRunAt: text("next_run_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    index("local_grid_trackers_project_idx").on(
      table.projectId,
      table.isActive,
      table.createdAt,
    ),
  ],
);

// One row per tracker run. gridJson holds the full GridPointResult[] so the
// heatmap can be re-rendered from history; the scalar columns power trend lines.
export const localGridSnapshots = sqliteTable(
  "local_grid_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    trackerId: text("tracker_id")
      .notNull()
      .references(() => localGridTrackers.id, { onDelete: "cascade" }),
    avgRank: real("avg_rank"),
    pointsFound: integer("points_found").notNull().default(0),
    pointsSearched: integer("points_searched").notNull().default(0),
    top3Count: integer("top3_count").notNull().default(0),
    top10Count: integer("top10_count").notNull().default(0),
    zoom: integer("zoom"),
    gridJson: text("grid_json").notNull(),
    capturedAt: text("captured_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    index("local_grid_snapshots_tracker_idx").on(
      table.trackerId,
      table.capturedAt,
    ),
  ],
);
