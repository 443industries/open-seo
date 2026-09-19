import { useState, type FormEvent } from "react";
import { sortBy } from "remeda";
import { AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { SafeExternalLink } from "@/client/components/SafeExternalLink";
import { AiVisibilityScorecard } from "@/client/features/ai-search/components/AiVisibilityScorecard";
import { useAiVisibilityQuery } from "@/client/features/ai-search/hooks/useAiVisibilityQuery";
import { parseCompetitorList } from "@/types/schemas/ai-search";
import type { BrandLookupResult } from "@/types/schemas/ai-search";

type Props = {
  projectId: string;
  initialQuery: string;
  initialCompetitors: string[];
  onChange: (query: string, competitors: string[]) => void;
};

const PLATFORM_LABEL: Record<string, string> = {
  chat_gpt: "ChatGPT",
  google: "Google AI Overviews",
};

export function AiVisibilityPage({
  projectId,
  initialQuery,
  initialCompetitors,
  onChange,
}: Props) {
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [competitorsInput, setCompetitorsInput] = useState(
    initialCompetitors.join(", "),
  );
  const [query, setQuery] = useState(initialQuery);
  const [competitors, setCompetitors] = useState(initialCompetitors);

  const visibility = useAiVisibilityQuery({ projectId, query, competitors });

  function submit(e: FormEvent) {
    e.preventDefault();
    const nextQuery = queryInput.trim();
    const nextCompetitors = parseCompetitorList(competitorsInput);
    setQuery(nextQuery);
    setCompetitors(nextCompetitors);
    onChange(nextQuery, nextCompetitors);
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Sparkles size={24} /> AI Visibility
        </h1>
        <p className="text-sm text-base-content/60">
          How visible your brand is in AI answers (ChatGPT + Google AI
          Overviews) — one health grade, share of voice vs competitors, trend,
          and the pages AI cites.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="input input-bordered flex-1"
            placeholder="Your brand or domain (e.g. talkingquest.com)"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            maxLength={200}
          />
          <button type="submit" className="btn btn-primary">
            Analyze
          </button>
        </div>
        <input
          className="input input-bordered input-sm w-full"
          placeholder="Competitors for share of voice, comma-separated (optional)"
          value={competitorsInput}
          onChange={(e) => setCompetitorsInput(e.target.value)}
        />
      </form>

      {visibility.isError ? (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{getStandardErrorMessage(visibility.error)}</span>
        </div>
      ) : null}

      {query === "" ? (
        <EmptyState />
      ) : visibility.isLoading ? (
        <div className="flex items-center gap-2 text-base-content/60 py-10 justify-center">
          <Loader2 className="animate-spin" size={18} /> Measuring AI
          visibility…
        </div>
      ) : visibility.data && !visibility.data.result.hasData ? (
        <div className="alert">
          <AlertCircle size={18} />
          <span>
            No AI-mention data for “{query}”. It may not yet be cited in AI
            answers — that itself is the signal to act on.
          </span>
        </div>
      ) : visibility.data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <AiVisibilityScorecard scorecard={visibility.data.scorecard} />
          <div className="space-y-6">
            <PlatformBreakdown result={visibility.data.result} />
            <ShareOfVoice result={visibility.data.result} />
            <TrendChart result={visibility.data.result} />
          </div>
          <div className="lg:col-span-2">
            <CitedPages result={visibility.data.result} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body items-center text-center py-12">
        <Sparkles className="text-base-content/30" size={40} />
        <p className="font-medium">Measure your AI visibility</p>
        <p className="text-sm text-base-content/60 max-w-md">
          Enter your brand or domain to get a health grade. Add competitors to
          see your share of AI answers against them.
        </p>
      </div>
    </div>
  );
}

function PlatformBreakdown({ result }: { result: BrandLookupResult }) {
  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body p-4">
        <h3 className="font-semibold text-sm">By platform</h3>
        <div className="grid grid-cols-2 gap-3">
          {result.perPlatform.map((p) => (
            <div
              key={p.platform}
              className="rounded-box border border-base-200 p-3"
            >
              <p className="text-xs text-base-content/60">
                {PLATFORM_LABEL[p.platform] ?? p.platform}
              </p>
              <p className="text-xl font-semibold">
                {p.status === "error" ? "—" : (p.mentions ?? 0)}
              </p>
              <p className="text-xs text-base-content/50">mentions</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShareOfVoice({ result }: { result: BrandLookupResult }) {
  const sov = result.shareOfVoice;
  if (!sov || sov.entries.length === 0) {
    return (
      <div className="card bg-base-100 border border-base-300">
        <div className="card-body p-4">
          <h3 className="font-semibold text-sm">Share of voice</h3>
          <p className="text-sm text-base-content/60">
            Add competitors above to compare your share of AI mentions.
          </p>
        </div>
      </div>
    );
  }
  const max = Math.max(...sov.entries.map((e) => e.sharePct ?? 0), 1);
  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body p-4">
        <h3 className="font-semibold text-sm">Share of voice</h3>
        <ul className="space-y-2 mt-1">
          {sortBy(sov.entries, [(e) => e.sharePct ?? 0, "desc"]).map((e) => (
              <li key={e.label}>
                <div className="flex justify-between text-xs">
                  <span className={e.isTarget ? "font-semibold" : ""}>
                    {e.label}
                    {e.isTarget ? " (you)" : ""}
                  </span>
                  <span>{e.sharePct != null ? `${e.sharePct.toFixed(1)}%` : "—"}</span>
                </div>
                <div className="h-2 rounded bg-base-200 overflow-hidden">
                  <div
                    className={e.isTarget ? "h-full bg-primary" : "h-full bg-base-content/30"}
                    style={{ width: `${((e.sharePct ?? 0) / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

function TrendChart({ result }: { result: BrandLookupResult }) {
  const months = result.monthlyVolume;
  const max = Math.max(...months.map((m) => m.volume ?? 0), 1);
  if (months.length === 0) return null;
  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body p-4">
        <h3 className="font-semibold text-sm">Mention volume trend</h3>
        <div className="flex items-end gap-1 h-24 mt-2">
          {months.map((m) => (
            <div
              key={`${m.year}-${m.month}`}
              className="flex-1 bg-primary/70 rounded-t"
              style={{
                height: `${((m.volume ?? 0) / max) * 100}%`,
                minHeight: "2px",
              }}
              title={`${m.year}-${String(m.month).padStart(2, "0")}: ${m.volume ?? 0}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CitedPages({ result }: { result: BrandLookupResult }) {
  if (result.topPages.length === 0) return null;
  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body p-4">
        <h3 className="font-semibold text-sm">Your pages AI cites</h3>
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Page</th>
                <th>Platform</th>
                <th>Mentions</th>
              </tr>
            </thead>
            <tbody>
              {result.topPages.slice(0, 15).map((p, i) => (
                <tr key={i}>
                  <td className="max-w-md truncate">
                    <SafeExternalLink
                      url={p.url}
                      label={p.url}
                      className="link link-primary inline-flex items-center gap-1"
                    />
                  </td>
                  <td className="text-xs">
                    {PLATFORM_LABEL[p.platform] ?? p.platform}
                  </td>
                  <td>{p.mentions ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
