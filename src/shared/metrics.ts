// Shared metric taxonomy for scheduled overview metrics (Phase 2b). Kept in
// shared/ so both the server service and client ScheduleBar use one source.

export const METRIC_TYPES = [
  "traffic",
  "domain_overview",
  "backlinks",
] as const;
export type MetricType = (typeof METRIC_TYPES)[number];

export type MetricSummary = Record<string, number | null>;

/** The headline figure the trend chart plots, per metric. */
export const METRIC_PRIMARY: Record<
  MetricType,
  { key: string; label: string }
> = {
  traffic: { key: "organicEtv", label: "Est. organic traffic" },
  domain_overview: { key: "organicTraffic", label: "Organic traffic" },
  backlinks: { key: "backlinks", label: "Backlinks" },
};
