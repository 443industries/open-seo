import { dataforseoPost } from "@/server/lib/dataforseo/core";
import {
  assertOk,
  buildTaskBilling,
  type DataforseoApiResponse,
  type DataforseoItemsTask,
} from "@/server/lib/dataforseo/envelope";

// Competitive-intelligence Labs endpoints (split out of labs.ts to keep it
// under the max-lines limit): competitor traffic estimation + organic
// competitor discovery.

// bulk_traffic_estimation: estimated organic traffic (ETV) + keyword counts for
// up to 1,000 domains in one call — how you compare competitor traffic without
// their analytics. One shared item shape per target.
export type BulkTrafficItem = {
  target?: string | null;
  metrics?: {
    organic?: {
      etv?: number | null;
      count?: number | null;
      [key: string]: unknown;
    } | null;
    paid?: {
      etv?: number | null;
      count?: number | null;
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

// competitors_domain: organic competitors of a target domain — domains that
// rank for the same keywords, with overlap + traffic. Backs "suggest
// competitors" and the Competitor Research view.
export type CompetitorDomainItem = {
  domain?: string | null;
  avg_position?: number | null;
  intersections?: number | null;
  full_domain_metrics?: {
    organic?: { etv?: number | null; count?: number | null } | null;
    [key: string]: unknown;
  } | null;
  metrics?: {
    organic?: { etv?: number | null; count?: number | null } | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

export async function fetchCompetitorsDomain(input: {
  target: string;
  locationCode: number;
  languageCode: string;
  limit: number;
}): Promise<DataforseoApiResponse<CompetitorDomainItem[]>> {
  const response = await dataforseoPost<
    DataforseoItemsTask<CompetitorDomainItem>
  >("/v3/dataforseo_labs/google/competitors_domain/live", [
    {
      target: input.target,
      location_code: input.locationCode,
      language_code: input.languageCode,
      limit: input.limit,
      // Exclude the target itself and require real keyword overlap.
      filters: [["metrics.organic.count", ">", 0]],
    },
  ]);
  const task = assertOk(response);
  return {
    data: task.result?.[0]?.items ?? [],
    billing: buildTaskBilling(task),
  };
}

export async function fetchBulkTrafficEstimation(input: {
  targets: string[];
  locationCode: number;
  languageCode: string;
}): Promise<DataforseoApiResponse<BulkTrafficItem[]>> {
  const response = await dataforseoPost<DataforseoItemsTask<BulkTrafficItem>>(
    "/v3/dataforseo_labs/google/bulk_traffic_estimation/live",
    [
      {
        targets: input.targets,
        location_code: input.locationCode,
        language_code: input.languageCode,
        item_types: ["organic", "paid"],
      },
    ],
  );
  const task = assertOk(response);
  return {
    data: task.result?.[0]?.items ?? [],
    billing: buildTaskBilling(task),
  };
}
