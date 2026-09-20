import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { projects } from "./app.schema";

// Phase 2b: scheduled overview metrics per project. One schedule row per
// (project, metricType); each run stores a compact summary snapshot so the tab
// can chart the client domain's trend over time. Metric compute reuses the
// existing services (traffic / domain overview / backlinks) — see
// ProjectMetricService.

const METRIC_TYPES = ["traffic", "domain_overview", "backlinks"] as const;
const INTERVALS = ["daily", "weekly", "monthly", "manual"] as const;

export const projectMetricSchedules = sqliteTable(
  "project_metric_schedules",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    metricType: text("metric_type", { enum: METRIC_TYPES }).notNull(),
    scheduleInterval: text("schedule_interval", { enum: INTERVALS })
      .notNull()
      .default("manual"),
    isActive: integer("is_active", { mode: "boolean" })
      .notNull()
      .default(false),
    lastRunAt: text("last_run_at"),
    nextRunAt: text("next_run_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    uniqueIndex("project_metric_schedules_project_metric_idx").on(
      table.projectId,
      table.metricType,
    ),
  ],
);

export const projectMetricSnapshots = sqliteTable(
  "project_metric_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    metricType: text("metric_type", { enum: METRIC_TYPES }).notNull(),
    // JSON MetricSummary — compact key figures for the trend chart.
    summaryJson: text("summary_json").notNull(),
    capturedAt: text("captured_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    index("project_metric_snapshots_project_metric_idx").on(
      table.projectId,
      table.metricType,
      table.capturedAt,
    ),
  ],
);
