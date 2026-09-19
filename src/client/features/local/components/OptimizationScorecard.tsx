import { Check, X } from "lucide-react";
import { radialStyle } from "@/client/lib/radialStyle";
import type {
  OptimizationScorecard as Scorecard,
  OptimizationCheck,
} from "@/server/features/local/services/LocalProfileService";

const GRADE_COLOR: Record<Scorecard["grade"], string> = {
  A: "text-success",
  B: "text-success",
  C: "text-warning",
  D: "text-warning",
  F: "text-error",
};

function CheckRow({ check }: { check: OptimizationCheck }) {
  return (
    <li className="flex items-start gap-3 py-2 border-b border-base-200 last:border-0">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          check.passed ? "bg-success/15 text-success" : "bg-error/15 text-error"
        }`}
      >
        {check.passed ? <Check size={13} /> : <X size={13} />}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {check.label}
          <span className="ml-2 text-xs text-base-content/40">
            {check.weight} pts
          </span>
        </p>
        <p className="text-xs text-base-content/60">{check.detail}</p>
      </div>
    </li>
  );
}

export function OptimizationScorecard({ scorecard }: { scorecard: Scorecard }) {
  const passed = scorecard.checks.filter((c) => c.passed).length;
  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body p-5">
        <div className="flex items-center gap-5">
          <div
            className={`radial-progress ${GRADE_COLOR[scorecard.grade]}`}
            style={radialStyle(scorecard.score, "5rem", "0.5rem")}
            role="progressbar"
            aria-label={`GBP optimization score ${scorecard.score} of 100`}
          >
            <span className="text-lg font-bold">{scorecard.score}</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-base-content/60">
              GBP optimization
            </p>
            <p className="text-2xl font-semibold">
              Grade{" "}
              <span className={GRADE_COLOR[scorecard.grade]}>
                {scorecard.grade}
              </span>
            </p>
            <p className="text-xs text-base-content/50">
              {passed}/{scorecard.checks.length} checks passing
            </p>
          </div>
        </div>
        <ul className="mt-4">
          {scorecard.checks.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </ul>
      </div>
    </div>
  );
}
