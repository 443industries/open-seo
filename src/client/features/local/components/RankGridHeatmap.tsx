import type {
  LocalRankGridResult,
  GridPointResult,
} from "@/server/features/local/services/localRankGrid";

// Green (top 3) → amber (top 10) → red (deeper) → grey (not found). Matches the
// map-pack heatmap operators expect from a local grid tracker.
function cellColor(point: GridPointResult): string {
  if (point.error) return "bg-base-300 text-base-content/40";
  if (point.rank == null) return "bg-base-200 text-base-content/40";
  if (point.rank <= 3) return "bg-success text-success-content";
  if (point.rank <= 10) return "bg-warning text-warning-content";
  return "bg-error text-error-content";
}

function cellLabel(point: GridPointResult): string {
  if (point.error) return "×";
  if (point.rank == null) return "–";
  return point.rank > 20 ? "20+" : String(point.rank);
}

export function RankGridHeatmap({ result }: { result: LocalRankGridResult }) {
  const { grid, summary, gridSize } = result;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="stat bg-base-100 border border-base-300 rounded-box p-3">
          <div className="stat-title text-xs">Avg rank</div>
          <div className="stat-value text-2xl">
            {summary.averageRank ?? "—"}
          </div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-box p-3">
          <div className="stat-title text-xs">Coverage</div>
          <div className="stat-value text-2xl">
            {summary.pointsFound}/{summary.pointsSearched}
          </div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-box p-3">
          <div className="stat-title text-xs">Top 3</div>
          <div className="stat-value text-2xl text-success">
            {summary.top3Count}
          </div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-box p-3">
          <div className="stat-title text-xs">Top 10</div>
          <div className="stat-value text-2xl text-warning">
            {summary.top10Count}
          </div>
        </div>
      </div>

      <div
        className="grid gap-1.5 w-fit"
        style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
      >
        {grid.map((point) => (
          <div
            key={`${point.row}-${point.col}`}
            className={`flex h-14 w-14 items-center justify-center rounded-md text-sm font-semibold ${cellColor(point)}`}
            title={
              point.error
                ? "Search failed at this point"
                : point.rank == null
                  ? `Not in top 20 here — ${point.resultsCount ?? 0} results, #1 ${point.topResult?.title ?? "?"}`
                  : `Rank ${point.rank} — #1 ${point.topResult?.title ?? "?"}`
            }
          >
            {cellLabel(point)}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-base-content/60">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-success" /> Top 3
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-warning" /> Top 10
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-error" /> 11–20
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-base-200" /> Not found
        </span>
      </div>
    </div>
  );
}
