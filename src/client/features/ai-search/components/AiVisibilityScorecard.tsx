import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { radialStyle } from "@/client/lib/radialStyle";
import type { AiVisibilityScorecard as Scorecard } from "@/shared/ai-visibility-score";

const GRADE_COLOR: Record<Scorecard["grade"], string> = {
  A: "text-success",
  B: "text-success",
  C: "text-warning",
  D: "text-warning",
  F: "text-error",
};

function TrendBadge({ trend }: { trend: Scorecard["trend"] }) {
  if (trend === "rising")
    return (
      <span className="badge badge-success gap-1">
        <TrendingUp size={12} /> Rising
      </span>
    );
  if (trend === "falling")
    return (
      <span className="badge badge-error gap-1">
        <TrendingDown size={12} /> Falling
      </span>
    );
  if (trend === "flat")
    return (
      <span className="badge badge-ghost gap-1">
        <Minus size={12} /> Flat
      </span>
    );
  return <span className="badge badge-ghost">No trend</span>;
}

export function AiVisibilityScorecard({ scorecard }: { scorecard: Scorecard }) {
  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body p-5">
        <div className="flex flex-wrap items-center gap-5">
          <div
            className={`radial-progress ${GRADE_COLOR[scorecard.grade]}`}
            style={radialStyle(scorecard.score, "5.5rem", "0.55rem")}
            role="progressbar"
            aria-label={`AI visibility score ${scorecard.score} of 100`}
          >
            <span className="text-xl font-bold">{scorecard.score}</span>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-base-content/60">
              AI visibility health
            </p>
            <p className="text-2xl font-semibold">
              Grade{" "}
              <span className={GRADE_COLOR[scorecard.grade]}>
                {scorecard.grade}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <TrendBadge trend={scorecard.trend} />
              {scorecard.targetSharePct != null ? (
                <span className="text-base-content/70">
                  {scorecard.targetSharePct.toFixed(1)}% share
                  {scorecard.targetRank
                    ? ` · rank #${scorecard.targetRank} of ${scorecard.competitorCount + 1}`
                    : ""}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <ul className="mt-4">
          {scorecard.components.map((c) => {
            const pct = c.weight ? Math.round((c.earned / c.weight) * 100) : 0;
            return (
              <li
                key={c.id}
                className="py-2 border-b border-base-200 last:border-0"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{c.label}</span>
                  <span className="text-base-content/50 text-xs">
                    {c.earned}/{c.weight}
                  </span>
                </div>
                <progress
                  className={`progress w-full h-1.5 ${
                    pct >= 75
                      ? "progress-success"
                      : pct >= 40
                        ? "progress-warning"
                        : "progress-error"
                  }`}
                  value={c.earned}
                  max={c.weight}
                />
                <p className="text-xs text-base-content/60">{c.detail}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
