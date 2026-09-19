import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Loader2, BarChart3 } from "lucide-react";
import { getTraffic } from "@/serverFunctions/traffic";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { SafeExternalLink } from "@/client/components/SafeExternalLink";

function parseList(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ).slice(0, 9);
}

function fmt(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toString();
}

type Props = {
  projectId: string;
  initialDomain: string;
  initialCompetitors: string[];
  onChange: (domain: string, competitors: string[]) => void;
};

export function TrafficPage({
  projectId,
  initialDomain,
  initialCompetitors,
  onChange,
}: Props) {
  const [domainInput, setDomainInput] = useState(initialDomain);
  const [competitorsInput, setCompetitorsInput] = useState(
    initialCompetitors.join(", "),
  );
  const [domain, setDomain] = useState(initialDomain);
  const [competitors, setCompetitors] = useState(initialCompetitors);

  const traffic = useQuery({
    enabled: domain.trim() !== "",
    queryKey: ["traffic", projectId, domain, competitors],
    queryFn: () =>
      getTraffic({ data: { domain: domain.trim(), competitors } }),
    staleTime: 10 * 60_000,
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const d = domainInput.trim();
    const c = parseList(competitorsInput);
    setDomain(d);
    setCompetitors(c);
    onChange(d, c);
  }

  const maxEtv = traffic.data
    ? Math.max(...traffic.data.competitors.map((c) => c.organicEtv ?? 0), 1)
    : 1;

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <BarChart3 size={24} /> Traffic & Top Pages
        </h1>
        <p className="text-sm text-base-content/60">
          Estimated organic traffic for you vs competitors, and your top organic
          pages. For your own verified clicks &amp; sessions, see{" "}
          <Link
            to="/p/$projectId/search-performance"
            params={{ projectId }}
            className="link link-primary"
          >
            GSC Insights
          </Link>
          .
        </p>
      </div>

      <form onSubmit={submit} className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="input input-bordered flex-1"
            placeholder="Your domain (e.g. gbsurfersbjj.com)"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            Analyze
          </button>
        </div>
        <input
          className="input input-bordered input-sm w-full"
          placeholder="Competitor domains, comma-separated (optional, up to 9)"
          value={competitorsInput}
          onChange={(e) => setCompetitorsInput(e.target.value)}
        />
      </form>

      {traffic.isError ? (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{getStandardErrorMessage(traffic.error)}</span>
        </div>
      ) : null}

      {domain.trim() === "" ? (
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body items-center text-center py-12">
            <BarChart3 className="text-base-content/30" size={40} />
            <p className="font-medium">Estimate traffic for any domain</p>
            <p className="text-sm text-base-content/60 max-w-md">
              Add competitors to compare organic traffic head-to-head — no access
              to their analytics required.
            </p>
          </div>
        </div>
      ) : traffic.isLoading ? (
        <div className="flex items-center gap-2 text-base-content/60 py-10 justify-center">
          <Loader2 className="animate-spin" size={18} /> Estimating traffic…
        </div>
      ) : traffic.data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body p-4">
              <h3 className="font-semibold text-sm">Organic traffic comparison</h3>
              <ul className="space-y-2 mt-1">
                {traffic.data.competitors.map((c) => (
                  <li key={c.domain}>
                    <div className="flex justify-between text-xs">
                      <span className={c.isTarget ? "font-semibold" : ""}>
                        {c.domain}
                        {c.isTarget ? " (you)" : ""}
                      </span>
                      <span>
                        {fmt(c.organicEtv)} visits · {fmt(c.organicKeywords)} kw
                      </span>
                    </div>
                    <div className="h-2 rounded bg-base-200 overflow-hidden">
                      <div
                        className={
                          c.isTarget ? "h-full bg-primary" : "h-full bg-base-content/30"
                        }
                        style={{
                          width: `${((c.organicEtv ?? 0) / maxEtv) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300">
            <div className="card-body p-4">
              <h3 className="font-semibold text-sm">
                Your top organic pages
              </h3>
              {traffic.data.topPages.length ? (
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Page</th>
                        <th>Est. visits</th>
                        <th>Keywords</th>
                      </tr>
                    </thead>
                    <tbody>
                      {traffic.data.topPages.map((p, i) => (
                        <tr key={i}>
                          <td className="max-w-xs truncate">
                            <SafeExternalLink
                              url={p.url.startsWith("http") ? p.url : `https://${p.url}`}
                              label={p.url}
                              className="link link-primary inline-flex items-center gap-1"
                            />
                          </td>
                          <td>{fmt(p.organicEtv)}</td>
                          <td>{fmt(p.organicKeywords)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-base-content/60">
                  No page-level data for this domain.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
