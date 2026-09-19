import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  localProfileSchema,
  nearbyListingsSchema,
  localRankGridSchema,
  localReviewsSchema,
} from "@/types/schemas/local";
import { LocalProfileService } from "@/server/features/local/services/LocalProfileService";
import { computeLocalRankGrid } from "@/server/features/local/services/localRankGrid";
import {
  createDataforseoClient,
  fetchBusinessDataTaskResult,
} from "@/server/lib/dataforseo";
import {
  businessIdentifierKeyword,
  resolveBusinessIdentifier,
} from "@/server/mcp/tools/local-seo-shared";
import { readPath } from "@/server/mcp/table";
import { AppError } from "@/server/lib/errors";

// Turn the businessName/cid/placeId trio into DataForSEO's single `keyword`
// (which carries cid:/place_id: prefixes), matching the MCP local tools.
function resolveKeyword(input: {
  businessName?: string;
  cid?: string;
  placeId?: string;
}): string {
  const identifier = resolveBusinessIdentifier({
    businessName: input.businessName,
    cid: input.cid,
    placeId: input.placeId,
  });
  return businessIdentifierKeyword(identifier);
}

export const getLocalProfile = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(localProfileSchema)
  .handler(async ({ data, context }) =>
    LocalProfileService.getProfile(
      {
        projectId: context.projectId,
        keyword: resolveKeyword(data),
        near: data.near,
        locationCode: data.locationCode ?? context.project.locationCode,
        languageCode: data.languageCode ?? context.project.languageCode,
      },
      context,
    ),
  );

export const getNearbyListings = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(nearbyListingsSchema)
  .handler(async ({ data, context }) =>
    LocalProfileService.getNearbyListings(
      {
        projectId: context.projectId,
        categories: data.categories,
        title: data.title,
        near: data.near,
        limit: data.limit ?? 20,
      },
      context,
    ),
  );

export const getBusinessCategories = createServerFn({ method: "GET" })
  .middleware(requireProjectContext)
  .validator(z.object({ projectId: z.string().min(1) }))
  .handler(async () => LocalProfileService.listCategories());

export const getLocalRankGrid = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(localRankGridSchema)
  .handler(async ({ data, context }) => {
    const client = createDataforseoClient(context);
    return computeLocalRankGrid(client, {
      keyword: data.keyword,
      target: data.target,
      center: data.center,
      gridSize: data.gridSize,
      spacingKm: data.spacingKm,
      device: data.device,
      zoom: data.zoom,
      languageCode: data.languageCode ?? context.project.languageCode,
    });
  });

// Reviews are an async DataForSEO task. First call (no taskId) posts the job and
// returns { status:"processing", taskId }; call again with that taskId to
// collect at no extra charge. taskId format "google:<id>".
const REVIEWS_TASK_ID_PATTERN = /^google:(.+)$/;

type ShapedReview = {
  rank: number | null;
  when: string | null;
  rating: number | null;
  author: string | null;
  text: string | null;
  ownerAnswer: string | null;
  source: string | null;
  reviewId: string | null;
};

function readStr(row: unknown, ...path: string[]): string | null {
  const value = readPath(row, ...path);
  return typeof value === "string" ? value : null;
}

function shapeReview(row: unknown): ShapedReview {
  const rank = readPath(row, "rank_absolute");
  const rating = readPath(row, "rating", "value");
  return {
    rank: typeof rank === "number" ? rank : null,
    when: readStr(row, "time_ago") ?? readStr(row, "timestamp"),
    rating: typeof rating === "number" ? rating : null,
    author: readStr(row, "profile_name"),
    text: readStr(row, "review_text"),
    ownerAnswer: readStr(row, "owner_answer"),
    source: readStr(row, "source", "title") ?? "Google",
    reviewId: readStr(row, "review_id"),
  };
}

export const getBusinessReviews = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(localReviewsSchema)
  .handler(async ({ data, context }) => {
    const client = createDataforseoClient(context);

    // Collect phase.
    if (data.taskId) {
      const match = REVIEWS_TASK_ID_PATTERN.exec(data.taskId);
      if (!match) {
        throw new AppError(
          "VALIDATION_ERROR",
          'taskId must be the value this function returned ("google:<id>").',
        );
      }
      const outcome = await fetchBusinessDataTaskResult({
        endpoint: "reviews",
        taskId: match[1] ?? "",
      });
      if (outcome.status === "pending") {
        return { status: "processing" as const, taskId: data.taskId };
      }
      const items = readPath(outcome.result, "items");
      const reviews = Array.isArray(items) ? items.map(shapeReview) : [];
      return { status: "completed" as const, reviews };
    }

    // Post phase.
    const identifier = resolveBusinessIdentifier({
      businessName: data.businessName,
      cid: data.cid,
      placeId: data.placeId,
    });
    const rawId = await client.business.reviewsTaskPost({
      keyword: businessIdentifierKeyword(identifier),
      cid: data.cid,
      placeId: data.placeId,
      locationCode: data.locationCode ?? context.project.locationCode,
      languageCode: data.languageCode ?? context.project.languageCode,
      depth: data.depth ?? 50,
      sortBy: data.sortBy,
      includeOtherSources: false,
    });
    return { status: "processing" as const, taskId: `google:${rawId}` };
  });
