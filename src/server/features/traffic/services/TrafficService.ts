// Deep traffic view: competitor organic-traffic comparison (Labs
// bulk_traffic_estimation — traffic without their analytics) + the target's top
// organic pages (Labs relevant_pages). Owned real-traffic (GSC clicks / GA4
// sessions) lives on the GSC Insights page; this fills the competitor + page
// gap Semrush's Traffic/Top-Pages reports cover.

import { buildCacheKey, getCached, setCached } from "@/server/lib/r2-cache";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { createDataforseoClient } from "@/server/lib/dataforseo";
import { parseResearchTargetOrThrow } from "@/server/lib/domainUtils";

const TRAFFIC_TTL_SECONDS = 12 * 60 * 60;

export type CompetitorTrafficRow = {
  domain: string;
  isTarget: boolean;
  organicEtv: number | null;
  organicKeywords: number | null;
  paidEtv: number | null;
};

export type TopPageRow = {
  url: string;
  organicEtv: number | null;
  organicKeywords: number | null;
};

export type TrafficResult = {
  target: string;
  competitors: CompetitorTrafficRow[];
  topPages: TopPageRow[];
  fetchedAt: string;
  hasData: boolean;
};

async function getTraffic(
  input: {
    projectId: string;
    domain: string;
    competitors: string[];
    locationCode: number;
    languageCode: string;
  },
  billingCustomer: BillingCustomerContext,
): Promise<TrafficResult> {
  const target = parseResearchTargetOrThrow(input.domain).hostname;
  const competitorHosts = input.competitors
    .map((c) => {
      try {
        return parseResearchTargetOrThrow(c).hostname;
      } catch {
        return null;
      }
    })
    .filter((c): c is string => c != null && c !== target);

  const cacheKey = await buildCacheKey("traffic:overview", {
    organizationId: billingCustomer.organizationId,
    projectId: input.projectId,
    target,
    competitors: competitorHosts,
    locationCode: input.locationCode,
    languageCode: input.languageCode,
  });
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- our own cache entry, shape written by setCached below
  const cached = (await getCached(cacheKey)) as TrafficResult | null;
  if (cached && cached.hasData) return cached;

  const client = createDataforseoClient(billingCustomer);
  const targets = [target, ...competitorHosts].slice(0, 1000);

  const [trafficItems, pagesPage] = await Promise.all([
    client.domain.bulkTrafficEstimation({
      targets,
      locationCode: input.locationCode,
      languageCode: input.languageCode,
    }),
    client.domain.relevantPages({
      target,
      locationCode: input.locationCode,
      languageCode: input.languageCode,
      limit: 20,
      orderBy: ["metrics.organic.etv,desc"],
    }),
  ]);

  const byTarget = new Map(
    trafficItems.map((item) => [
      (item.target ?? "").toLowerCase(),
      item,
    ]),
  );
  const competitors: CompetitorTrafficRow[] = targets.map((domain) => {
    const item = byTarget.get(domain.toLowerCase());
    return {
      domain,
      isTarget: domain === target,
      organicEtv: item?.metrics?.organic?.etv ?? null,
      organicKeywords: item?.metrics?.organic?.count ?? null,
      paidEtv: item?.metrics?.paid?.etv ?? null,
    };
  });
  // Sort by organic traffic desc, target still flagged.
  competitors.sort((a, b) => (b.organicEtv ?? 0) - (a.organicEtv ?? 0));

  const topPages: TopPageRow[] = pagesPage.items.map((item) => ({
    url: item.page_address ?? "",
    organicEtv: item.metrics?.organic?.etv ?? null,
    organicKeywords: item.metrics?.organic?.count ?? null,
  }));

  const result: TrafficResult = {
    target,
    competitors,
    topPages,
    fetchedAt: new Date().toISOString(),
    hasData: competitors.some((c) => c.organicEtv != null) || topPages.length > 0,
  };
  if (result.hasData) await setCached(cacheKey, result, TRAFFIC_TTL_SECONDS);
  return result;
}

export const TrafficService = { getTraffic };
