import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sortBy } from "remeda";
import { Calendar, Play, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import {
  getMetricSchedule,
  setMetricSchedule,
  runMetricSnapshot,
} from "@/serverFunctions/metrics";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { METRIC_PRIMARY, type MetricType } from "@/shared/metrics";

type Interval = "daily" | "weekly" | "monthly" | "manual";

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toString();
}

// Compact bar sparkline (oldest → newest) of the metric's headline figure.
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-8" aria-hidden>
      {values.map((v, i) => (
        <div
          key={i}
          className="w-1.5 rounded-t bg-primary/70"
          style={{ height: `${(v / max) * 100}%`, minHeight: "2px" }}
        />
      ))}
    </div>
  );
}

export function ScheduleBar({
  projectId,
  metricType,
}: {
  projectId: string;
  metricType: MetricType;
}) {
  const qc = useQueryClient();
  const key = ["metric-schedule", projectId, metricType];
  const query = useQuery({
    queryKey: key,
    queryFn: () => getMetricSchedule({ data: { projectId, metricType } }),
    staleTime: 60_000,
  });
  const setSchedule = useMutation({
    mutationFn: (interval: Interval) =>
      setMetricSchedule({ data: { projectId, metricType, interval } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  const run = useMutation({
    mutationFn: () => runMetricSnapshot({ data: { projectId, metricType } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const primary = METRIC_PRIMARY[metricType];
  const interval = (query.data?.schedule?.scheduleInterval ?? "manual") as Interval;
  const nextRunAt = query.data?.schedule?.nextRunAt ?? null;
  // trend comes newest-first; sort oldest→newest for the sparkline.
  const trend = query.data?.trend ?? [];
  const series = sortBy(trend, (p) => p.capturedAt)
    .map((p) => p.summary[primary.key])
    .filter((v): v is number => typeof v === "number");
  const latest = series.length ? series[series.length - 1] : null;
  const prev = series.length > 1 ? series[series.length - 2] : null;
  const delta =
    latest != null && prev != null && prev !== 0 ? latest - prev : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 pt-4">
      <div className="card bg-base-100 border border-base-300">
        <div className="card-body p-3 flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Calendar size={15} className="text-base-content/50" />
            <span className="text-sm font-medium">Auto-track</span>
            <select
              className="select select-bordered select-xs"
              value={interval}
              disabled={setSchedule.isPending}
              onChange={(e) => {
                const v = e.target.value;
                setSchedule.mutate(
                  v === "daily" || v === "weekly" || v === "monthly"
                    ? v
                    : "manual",
                );
              }}
            >
              <option value="manual">Off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            {interval !== "manual" && nextRunAt ? (
              <span className="text-xs text-base-content/50">
                next {new Date(nextRunAt).toLocaleDateString()}
              </span>
            ) : null}
            <button
              className="btn btn-xs"
              disabled={run.isPending}
              onClick={() => run.mutate()}
              title="Capture a snapshot now"
            >
              {run.isPending ? (
                <Loader2 className="animate-spin" size={12} />
              ) : (
                <Play size={12} />
              )}
              Run now
            </button>
            {run.isError ? (
              <span className="text-xs text-error">
                {getStandardErrorMessage(run.error)}
              </span>
            ) : null}
          </div>

          {series.length > 0 ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-base-content/50">{primary.label}</p>
                <p className="text-lg font-semibold leading-none flex items-center gap-1 justify-end">
                  {fmt(latest)}
                  {delta != null && delta !== 0 ? (
                    <span
                      className={`text-xs inline-flex items-center ${delta > 0 ? "text-success" : "text-error"}`}
                    >
                      {delta > 0 ? (
                        <TrendingUp size={12} />
                      ) : (
                        <TrendingDown size={12} />
                      )}
                      {fmt(Math.abs(delta))}
                    </span>
                  ) : null}
                </p>
              </div>
              <Sparkline values={series} />
            </div>
          ) : (
            <span className="text-xs text-base-content/40">
              No snapshots yet — schedule it or run once.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
