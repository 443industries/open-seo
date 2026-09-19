import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
} from "drizzle-orm/pg-core";
import { projects } from "./app.schema";

// Timestamps stored as ISO text (matching the D1 schema); see app.schema.ts.
const isoNow = sql`to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const timestampColumn = (name: string) => text(name);

// ---------------------------------------------------------------------------
// Local Map Rank Tracker — persisted local rank grids tracked over time. PG
// mirror of the D1 local_grid_* tables (see src/db/app.schema.ts).
// ---------------------------------------------------------------------------
export const localGridTrackers = pgTable(
  "local_grid_trackers",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    keyword: text("keyword").notNull(),
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
    isActive: boolean("is_active").notNull().default(true),
    lastRunAt: timestampColumn("last_run_at"),
    nextRunAt: timestampColumn("next_run_at"),
    createdAt: timestampColumn("created_at").notNull().default(isoNow),
  },
  (table) => [
    index("local_grid_trackers_project_idx").on(
      table.projectId,
      table.isActive,
      table.createdAt,
    ),
  ],
);

export const localGridSnapshots = pgTable(
  "local_grid_snapshots",
  {
    id: serial("id").primaryKey(),
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
    capturedAt: timestampColumn("captured_at").notNull().default(isoNow),
  },
  (table) => [
    index("local_grid_snapshots_tracker_idx").on(
      table.trackerId,
      table.capturedAt,
    ),
  ],
);
