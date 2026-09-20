import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { projects } from "./app.schema";

// PG mirror of the D1 project_metric_* tables (see src/db/metrics.schema.ts).
const isoNow = sql`to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const timestampColumn = (name: string) => text(name);

const METRIC_TYPES = ["traffic", "domain_overview", "backlinks"] as const;
const INTERVALS = ["daily", "weekly", "monthly", "manual"] as const;

export const projectMetricSchedules = pgTable(
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
    isActive: boolean("is_active").notNull().default(false),
    lastRunAt: timestampColumn("last_run_at"),
    nextRunAt: timestampColumn("next_run_at"),
    createdAt: timestampColumn("created_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("project_metric_schedules_project_metric_idx").on(
      table.projectId,
      table.metricType,
    ),
  ],
);

export const projectMetricSnapshots = pgTable(
  "project_metric_snapshots",
  {
    id: serial("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    metricType: text("metric_type", { enum: METRIC_TYPES }).notNull(),
    summaryJson: text("summary_json").notNull(),
    capturedAt: timestampColumn("captured_at").notNull().default(isoNow),
  },
  (table) => [
    index("project_metric_snapshots_project_metric_idx").on(
      table.projectId,
      table.metricType,
      table.capturedAt,
    ),
  ],
);
