// AI-visibility health scorecard — a pure derivation over a BrandLookupResult
// (DataForSEO llm_mentions). Rolls the existing share-of-voice / per-platform /
// trend / cited-pages / query-breadth signals into one 0-100 health score so
// operators get a single "how visible are we in AI answers" read. No API calls;
// safe to run on client or server, and reused by a future MCP tool.

import { sortBy } from "remeda";
import type { BrandLookupResult } from "@/types/schemas/ai-search";

export type AiVisibilityComponent = {
  id: string;
  label: string;
  weight: number;
  earned: number;
  detail: string;
};

export type AiVisibilityScorecard = {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  components: AiVisibilityComponent[];
  // Convenience rollups for the header.
  targetSharePct: number | null;
  targetRank: number | null;
  competitorCount: number;
  trend: "rising" | "flat" | "falling" | "unknown";
};

function avg(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function trendDirection(
  monthly: BrandLookupResult["monthlyVolume"],
): "rising" | "flat" | "falling" | "unknown" {
  const vols = monthly
    .map((m) => m.volume)
    .filter((v): v is number => v != null);
  if (vols.length < 4) return "unknown";
  const half = Math.floor(vols.length / 2);
  const prior = vols.slice(0, vols.length - half);
  const recent = vols.slice(vols.length - half);
  const priorAvg = avg(prior);
  const recentAvg = avg(recent);
  if (priorAvg === 0) return recentAvg > 0 ? "rising" : "unknown";
  const change = (recentAvg - priorAvg) / priorAvg;
  if (change > 0.1) return "rising";
  if (change < -0.1) return "falling";
  return "flat";
}

export function computeAiVisibilityScorecard(
  result: BrandLookupResult,
): AiVisibilityScorecard {
  const mentioned = (result.totalMentions ?? 0) > 0;

  // Platform coverage.
  const platformsWithMentions = result.perPlatform.filter(
    (p) => (p.mentions ?? 0) > 0,
  ).length;

  // Share of voice.
  const sov = result.shareOfVoice;
  const targetEntry = sov?.entries.find((e) => e.isTarget) ?? null;
  const targetSharePct = targetEntry?.sharePct ?? null;
  const competitorCount = sov ? Math.max(0, sov.entries.length - 1) : 0;
  const ranked = sov
    ? sortBy(
        sov.entries.filter((e) => e.sharePct != null),
        [(e) => e.sharePct ?? 0, "desc"],
      )
    : [];
  const targetRank = targetEntry
    ? ranked.findIndex((e) => e.isTarget) + 1 || null
    : null;

  const trend = trendDirection(result.monthlyVolume);
  const citedPages = result.topPages.length;
  const queryBreadth = result.topQueries.length;

  const components: AiVisibilityComponent[] = [
    {
      id: "presence",
      label: "AI presence",
      weight: 25,
      earned: mentioned ? 25 : 0,
      detail: mentioned
        ? `Cited in ${result.totalMentions} AI answers.`
        : "Not cited in any AI answers yet — the core gap to close.",
    },
    {
      id: "platforms",
      label: "Platform coverage",
      weight: 15,
      earned: platformsWithMentions >= 2 ? 15 : platformsWithMentions === 1 ? 8 : 0,
      detail:
        platformsWithMentions >= 2
          ? "Present on both ChatGPT and Google AI Overviews."
          : platformsWithMentions === 1
            ? "Present on one platform — build presence on the other."
            : "Absent from both platforms.",
    },
    {
      id: "share-of-voice",
      label: "Share of voice",
      weight: 25,
      earned:
        targetSharePct == null
          ? mentioned
            ? 12
            : 0
          : targetSharePct >= 40
            ? 25
            : targetSharePct >= 25
              ? 20
              : targetSharePct >= 15
                ? 14
                : targetSharePct >= 5
                  ? 8
                  : targetSharePct > 0
                    ? 4
                    : 0,
      detail:
        targetSharePct == null
          ? "Add competitors to measure share of voice."
          : `${targetSharePct.toFixed(1)}% of mentions vs ${competitorCount} competitors` +
            (targetRank ? ` (rank #${targetRank}).` : "."),
    },
    {
      id: "trend",
      label: "Mention trend",
      weight: 15,
      earned:
        trend === "rising"
          ? 15
          : trend === "flat"
            ? 10
            : trend === "falling"
              ? 5
              : 0,
      detail:
        trend === "unknown"
          ? "Not enough history to read a trend."
          : `Mention volume is ${trend} over recent months.`,
    },
    {
      id: "cited-pages",
      label: "Cited pages",
      weight: 10,
      earned: citedPages >= 5 ? 10 : citedPages >= 1 ? 6 : 0,
      detail: citedPages
        ? `${citedPages} of your pages are cited in AI answers.`
        : "No pages cited — publish answer-shaped content.",
    },
    {
      id: "query-breadth",
      label: "Query breadth",
      weight: 10,
      earned: queryBreadth >= 20 ? 10 : queryBreadth >= 5 ? 6 : queryBreadth >= 1 ? 3 : 0,
      detail: queryBreadth
        ? `Mentioned across ${queryBreadth} distinct prompts.`
        : "Not surfaced for any tracked prompts.",
    },
  ];

  const score = components.reduce((sum, c) => sum + c.earned, 0);
  const grade =
    score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";

  return {
    score,
    grade,
    components,
    targetSharePct,
    targetRank,
    competitorCount,
    trend,
  };
}
