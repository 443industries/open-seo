import { useState } from "react";
import { sortBy } from "remeda";
import {
  AlertCircle,
  Loader2,
  MapPinned,
  Play,
  Trash2,
  Plus,
} from "lucide-react";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { RankGridHeatmap } from "@/client/features/local/components/RankGridHeatmap";
import { RankGridMap } from "@/client/features/local/components/RankGridMap";
import { CreateTrackerForm } from "@/client/features/local/components/CreateTrackerForm";
import {
  useTrackersQuery,
  useDeleteTrackerMutation,
  useRunTrackerMutation,
  useTrackerHistoryQuery,
} from "@/client/features/local/hooks/useTrackerQueries";
import type { LocalRankGridResult } from "@/server/features/local/services/localRankGrid";

export function MapRankTrackerPage({ projectId }: { projectId: string }) {
  const trackers = useTrackersQuery(projectId);
  const [selected, setSelected] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <MapPinned size={24} /> Map Rank Tracker
          </h1>
          <p className="text-sm text-base-content/60">
            Track your Google Maps rank grid over time. Each scheduled run stores
            a snapshot so you can watch Avg Rank, coverage, and share move.
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowCreate((v) => !v)}
        >
          <Plus size={16} /> New tracker
        </button>
      </div>

      {showCreate ? (
        <CreateTrackerForm
          projectId={projectId}
          onDone={() => setShowCreate(false)}
        />
      ) : null}

      {trackers.isLoading ? (
        <div className="flex items-center gap-2 text-base-content/60 py-10 justify-center">
          <Loader2 className="animate-spin" size={18} /> Loading trackers…
        </div>
      ) : trackers.isError ? (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{getStandardErrorMessage(trackers.error)}</span>
        </div>
      ) : trackers.data?.length ? (
        <div className="space-y-2">
          {trackers.data.map(({ tracker, latest }) => (
            <TrackerRow
              key={tracker.id}
              projectId={projectId}
              tracker={tracker}
              latestAvg={latest?.avgRank ?? null}
              expanded={selected === tracker.id}
              onToggle={() =>
                setSelected((s) => (s === tracker.id ? null : tracker.id))
              }
            />
          ))}
        </div>
      ) : (
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body items-center text-center py-12">
            <MapPinned className="text-base-content/30" size={40} />
            <p className="font-medium">No trackers yet</p>
            <p className="text-sm text-base-content/60 max-w-md">
              Create a tracker for a keyword + business + storefront location.
              Tip: use the Local SEO page to find your business coordinates.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

type TrackerRowProps = {
  projectId: string;
  tracker: {
    id: string;
    label: string;
    keyword: string;
    gridSize: number;
    scheduleInterval: string;
    lastRunAt: string | null;
    nextRunAt: string | null;
  };
  latestAvg: number | null;
  expanded: boolean;
  onToggle: () => void;
};

function TrackerRow({
  projectId,
  tracker,
  latestAvg,
  expanded,
  onToggle,
}: TrackerRowProps) {
  const run = useRunTrackerMutation(projectId);
  const del = useDeleteTrackerMutation(projectId);

  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body p-4">
        <div className="flex items-center justify-between gap-3">
          <button className="text-left min-w-0 flex-1" onClick={onToggle}>
            <p className="font-medium truncate">{tracker.label}</p>
            <p className="text-xs text-base-content/60 truncate">
              “{tracker.keyword}” · {tracker.gridSize}×{tracker.gridSize} ·{" "}
              {tracker.scheduleInterval}
              {tracker.lastRunAt
                ? ` · last ${new Date(tracker.lastRunAt).toLocaleDateString()}`
                : " · never run"}
            </p>
          </button>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-xs text-base-content/50">Avg rank</p>
              <p className="text-lg font-semibold">{latestAvg ?? "—"}</p>
            </div>
            <button
              className="btn btn-sm btn-primary"
              disabled={run.isPending}
              onClick={() => run.mutate(tracker.id)}
              title="Run now"
            >
              {run.isPending ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <Play size={14} />
              )}
            </button>
            <button
              className="btn btn-sm btn-ghost text-error"
              disabled={del.isPending}
              onClick={() => del.mutate(tracker.id)}
              title="Delete tracker"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {run.isError ? (
          <div className="alert alert-error mt-2">
            <AlertCircle size={16} />
            <span>{getStandardErrorMessage(run.error)}</span>
          </div>
        ) : null}

        {expanded ? (
          <TrackerDetail projectId={projectId} trackerId={tracker.id} />
        ) : null}
      </div>
    </div>
  );
}

function TrackerDetail({
  projectId,
  trackerId,
}: {
  projectId: string;
  trackerId: string;
}) {
  const history = useTrackerHistoryQuery(projectId, trackerId);

  if (history.isLoading) {
    return (
      <div className="flex items-center gap-2 text-base-content/60 py-6 justify-center">
        <Loader2 className="animate-spin" size={16} /> Loading history…
      </div>
    );
  }
  if (history.isError) {
    return (
      <div className="alert alert-error mt-3">
        <AlertCircle size={16} />
        <span>{getStandardErrorMessage(history.error)}</span>
      </div>
    );
  }
  const snapshots = history.data?.snapshots ?? [];
  const tracker = history.data?.tracker;
  if (snapshots.length === 0 || !tracker) {
    return (
      <p className="text-sm text-base-content/60 mt-3">
        No snapshots yet — run the tracker to capture the first grid.
      </p>
    );
  }

  // snapshots come newest-first; latest grid + oldest→newest trend.
  const latest = snapshots[0];
  const trend = sortBy(snapshots, (s) => s.capturedAt);
  if (!latest) return null;
  const center = { latitude: tracker.centerLat, longitude: tracker.centerLng };
  const latestResult: LocalRankGridResult = {
    grid: latest.grid,
    summary: {
      averageRank: latest.avgRank,
      pointsFound: latest.pointsFound,
      pointsSearched: latest.pointsSearched,
      top3Count: latest.top3Count,
      top10Count: latest.top10Count,
    },
    competitors: latest.competitors,
    matchedBusiness: null,
    gridSize: Math.round(Math.sqrt(latest.pointsSearched)) || 3,
    spacingKm: tracker.spacingKm,
    zoom: latest.zoom ?? 12,
  };

  return (
    <div className="mt-4 space-y-4 border-t border-base-200 pt-4">
      <p className="text-xs uppercase tracking-wide text-base-content/60">
        Latest scan ({new Date(latest.capturedAt).toLocaleString()})
      </p>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <RankGridMap
          grid={latest.grid}
          center={center}
          zoom={latest.zoom ?? 12}
        />
        <CompetitorPanel
          youLabel={tracker.targetName ?? tracker.label}
          youAvgRank={latest.avgRank}
          competitors={latest.competitors}
        />
      </div>
      <RankGridHeatmap result={latestResult} />
      <AvgRankTrend
        points={trend.map((s) => ({ at: s.capturedAt, avg: s.avgRank }))}
      />
    </div>
  );
}

function arColor(ar: number | null): string {
  if (ar == null) return "text-base-content/40";
  if (ar <= 3) return "text-success";
  if (ar <= 10) return "text-warning";
  return "text-error";
}

// You + top rivals with Avg Rank across the grid — Semrush's competitor list.
function CompetitorPanel({
  youLabel,
  youAvgRank,
  competitors,
}: {
  youLabel: string;
  youAvgRank: number | null;
  competitors: LocalRankGridResult["competitors"];
}) {
  return (
    <div className="card bg-base-100 border border-base-300 h-fit">
      <div className="card-body p-3 gap-1">
        <h3 className="text-sm font-semibold px-1">Competitors (Avg Rank)</h3>
        <ul className="divide-y divide-base-200">
          <li className="flex items-center justify-between gap-2 py-2 px-1 bg-primary/10 rounded">
            <span className="text-sm font-semibold truncate">
              {youLabel}
              <span className="badge badge-primary badge-xs ml-2">You</span>
            </span>
            <span className={`text-sm font-bold ${arColor(youAvgRank)}`}>
              {youAvgRank ?? "—"}
            </span>
          </li>
          {competitors.length === 0 ? (
            <li className="py-3 px-1 text-xs text-base-content/50">
              No rivals surfaced across the grid.
            </li>
          ) : (
            competitors.map((c) => (
              <li
                key={c.cid ?? c.title}
                className="flex items-center justify-between gap-2 py-2 px-1"
              >
                <span className="text-sm truncate">
                  {c.title}
                  <span className="text-xs text-base-content/40 ml-1">
                    {Math.round(c.coverage * 100)}%
                  </span>
                </span>
                <span className={`text-sm font-semibold ${arColor(c.avgRank)}`}>
                  {c.avgRank}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

// Avg rank is "lower is better", so the chart is inverted (higher bar = better
// rank). Bars are scaled against the worst observed rank in the window.
function AvgRankTrend({
  points,
}: {
  points: { at: string; avg: number | null }[];
}) {
  const known = points.filter(
    (p): p is { at: string; avg: number } => p.avg != null,
  );
  if (known.length < 2) return null;
  const worst = Math.max(...known.map((p) => p.avg), 1);
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-base-content/60 mb-2">
        Avg rank over time (higher bar = better)
      </p>
      <div className="flex items-end gap-1 h-20">
        {points.map((p, i) => (
          <div
            key={i}
            className={`flex-1 rounded-t ${p.avg == null ? "bg-base-200" : "bg-primary/70"}`}
            style={{
              height:
                p.avg == null
                  ? "4px"
                  : `${(1 - (p.avg - 1) / worst) * 100}%`,
              minHeight: "4px",
            }}
            title={`${new Date(p.at).toLocaleDateString()}: ${p.avg ?? "—"}`}
          />
        ))}
      </div>
    </div>
  );
}

