import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { createDataforseoClient } from "@/server/lib/dataforseo";
import { normalizeDomain } from "@/types/schemas/domain";

function safeHost(input: string): string | null {
  try {
    return normalizeDomain(input);
  } catch {
    return null;
  }
}

export type SuggestedCompetitor = {
  domain: string;
  intersections: number | null;
  organicTraffic: number | null;
};

/**
 * Suggests organic competitors for the project's own domain (Labs
 * competitors_domain): domains ranking for the same keywords. Feeds the
 * project competitor manager's one-click "suggest" and, later, Competitor
 * Research. Excludes the project domain itself and dedupes to bare hosts.
 */
export const suggestProjectCompetitors = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(
    z.object({
      projectId: z.string().min(1),
      limit: z.number().int().min(1).max(30).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const projectDomain = context.project.domain;
    if (!projectDomain) {
      return { competitors: [] as SuggestedCompetitor[], hasDomain: false };
    }
    const limit = data.limit ?? 15;
    const self = safeHost(projectDomain);
    const client = createDataforseoClient(context);
    const items = await client.domain.competitorsDomain({
      target: projectDomain,
      locationCode: context.project.locationCode,
      languageCode: context.project.languageCode,
      limit: limit + 5,
    });

    const seen = new Set<string>();
    const competitors: SuggestedCompetitor[] = [];
    for (const item of items) {
      if (item.domain == null) continue;
      const host = safeHost(item.domain);
      if (host == null || host === self || seen.has(host)) continue;
      seen.add(host);
      competitors.push({
        domain: host,
        intersections: item.intersections ?? null,
        organicTraffic:
          item.full_domain_metrics?.organic?.etv ??
          item.metrics?.organic?.etv ??
          null,
      });
      if (competitors.length >= limit) break;
    }
    return { competitors, hasDomain: true };
  });
