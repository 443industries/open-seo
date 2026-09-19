import { z } from "zod";

// Coordinate the storefront sits at; also the center of the rank grid.
export const nearSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusKm: z.number().min(0.2).max(199).optional(),
});

// Exactly one of these identifies the business Google-side.
const businessIdentifierFields = {
  businessName: z.string().min(1).max(200).optional(),
  cid: z.string().min(1).max(64).optional(),
  placeId: z.string().min(1).max(256).optional(),
};

export const localProfileSchema = z.object({
  // Project context is resolved from data.projectId by ensureUserMiddleware.
  projectId: z.string().min(1),
  ...businessIdentifierFields,
  near: nearSchema.optional(),
  locationCode: z.number().int().optional(),
  languageCode: z.string().min(2).max(10).optional(),
});
export type LocalProfileRequest = z.infer<typeof localProfileSchema>;

export const nearbyListingsSchema = z.object({
  projectId: z.string().min(1),
  categories: z.array(z.string().min(1)).max(10).optional(),
  title: z.string().min(1).max(200).optional(),
  near: nearSchema,
  limit: z.number().int().min(1).max(100).optional(),
});

export const localRankGridSchema = z.object({
  projectId: z.string().min(1),
  keyword: z.string().min(1).max(120),
  target: z.object({
    cid: z.string().min(1).max(64).optional(),
    placeId: z.string().min(1).max(256).optional(),
    name: z.string().min(1).max(200).optional(),
  }),
  center: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  gridSize: z.union([z.literal(3), z.literal(5)]).optional(),
  spacingKm: z.number().min(0.25).max(10).optional(),
  device: z.enum(["desktop", "mobile"]).optional(),
  zoom: z.number().int().min(4).max(18).optional(),
  languageCode: z.string().min(2).max(10).optional(),
});
export type LocalRankGridRequest = z.infer<typeof localRankGridSchema>;

export const localReviewsSchema = z.object({
  projectId: z.string().min(1),
  ...businessIdentifierFields,
  near: nearSchema.optional(),
  locationCode: z.number().int().optional(),
  languageCode: z.string().min(2).max(10).optional(),
  depth: z.number().int().min(10).max(490).optional(),
  sortBy: z.enum(["newest", "highest_rating", "lowest_rating"]).optional(),
  // Reviews are an async DataForSEO task: the first call posts and returns a
  // taskId; a follow-up call with the taskId collects the result.
  taskId: z.string().min(1).max(64).optional(),
});
export type LocalReviewsRequest = z.infer<typeof localReviewsSchema>;

// Search UI default (kept out of the route file, matching other features).
export const localSearchSchema = z.object({
  businessName: z.string().optional(),
  cid: z.string().optional(),
  tab: z.enum(["overview", "grid", "reviews", "competitors"]).optional(),
});
