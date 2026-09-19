// Local SEO profile + optimization scorecard. Reads the live Google Business
// Profile (my_business_info) and nearby listings (business_listings/search),
// shapes them for the dashboard, and derives a GBP-optimization score from
// profile completeness — the "GBP optimization" surface. Read-only: editing a
// listing needs the Google Business Profile API (a separate write integration).

import { buildCacheKey, getCached, setCached } from "@/server/lib/r2-cache";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import {
  createDataforseoClient,
  fetchBusinessListingsCategories,
} from "@/server/lib/dataforseo";
import { readPath } from "@/server/mcp/table";
import { formatBusinessDataCoordinate } from "@/server/mcp/tools/local-seo-shared";

const PROFILE_TTL_SECONDS = 6 * 60 * 60;
const LISTINGS_TTL_SECONDS = 24 * 60 * 60;

export type BusinessProfile = {
  title: string | null;
  category: string | null;
  additionalCategories: string[];
  rating: number | null;
  reviewsCount: number | null;
  ratingDistribution: Record<string, number> | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  domain: string | null;
  isClaimed: boolean | null;
  currentStatus: string | null;
  hasHours: boolean;
  totalPhotos: number | null;
  description: string | null;
  attributesCount: number;
  cid: string | null;
  placeId: string | null;
  checkUrl: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type OptimizationCheck = {
  id: string;
  label: string;
  weight: number;
  passed: boolean;
  detail: string;
};

export type OptimizationScorecard = {
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  checks: OptimizationCheck[];
};

export type LocalProfileResult = {
  profile: BusinessProfile;
  scorecard: OptimizationScorecard;
  fetchedAt: string;
  hasData: boolean;
};

function readNumber(source: unknown, ...path: string[]): number | null {
  const value = readPath(source, ...path);
  return typeof value === "number" ? value : null;
}

function readString(source: unknown, ...path: string[]): string | null {
  const value = readPath(source, ...path);
  return typeof value === "string" ? value : null;
}

function readBool(source: unknown, ...path: string[]): boolean | null {
  const value = readPath(source, ...path);
  return typeof value === "boolean" ? value : null;
}

function shapeRatingDistribution(
  profile: unknown,
): Record<string, number> | null {
  const raw = readPath(profile, "rating_distribution");
  if (raw == null || typeof raw !== "object") return null;
  const out: Record<string, number> = {};
  for (const [star, count] of Object.entries(raw)) {
    if (typeof count === "number") out[star] = count;
  }
  return Object.keys(out).length ? out : null;
}

function shapeProfile(raw: unknown): BusinessProfile {
  const additional = readPath(raw, "additional_categories");
  const attributes = readPath(raw, "attributes");
  const timetable = readPath(raw, "work_time", "work_hours", "timetable");
  return {
    title: readString(raw, "title"),
    category: readString(raw, "category"),
    additionalCategories: Array.isArray(additional)
      ? additional.filter((c): c is string => typeof c === "string")
      : [],
    rating: readNumber(raw, "rating", "value"),
    reviewsCount: readNumber(raw, "rating", "votes_count"),
    ratingDistribution: shapeRatingDistribution(raw),
    address: readString(raw, "address"),
    phone: readString(raw, "phone"),
    website: readString(raw, "url"),
    domain: readString(raw, "domain"),
    isClaimed: readBool(raw, "is_claimed"),
    currentStatus: readString(
      raw,
      "work_time",
      "work_hours",
      "current_status",
    ),
    hasHours: timetable != null && typeof timetable === "object",
    totalPhotos: readNumber(raw, "total_photos"),
    description: readString(raw, "description"),
    attributesCount:
      attributes != null && typeof attributes === "object"
        ? Object.keys(attributes).length
        : 0,
    cid: readString(raw, "cid"),
    placeId: readString(raw, "place_id"),
    checkUrl: readString(raw, "check_url"),
    latitude: readNumber(raw, "latitude"),
    longitude: readNumber(raw, "longitude"),
  };
}

// Weighted completeness checks. Weights sum to 100; a business's score is the
// sum of the weights whose checks pass. Mirrors the levers a local-SEO operator
// actually pulls in GBP.
function buildScorecard(profile: BusinessProfile): OptimizationScorecard {
  const checks: OptimizationCheck[] = [
    {
      id: "claimed",
      label: "Profile claimed",
      weight: 15,
      passed: profile.isClaimed === true,
      detail:
        profile.isClaimed === true
          ? "Verified/claimed on Google."
          : "Unclaimed — claim it to control the listing and respond to reviews.",
    },
    {
      id: "category",
      label: "Primary category set",
      weight: 12,
      passed: !!profile.category,
      detail: profile.category
        ? `Primary category: ${profile.category}.`
        : "No primary category — set the most specific one that fits.",
    },
    {
      id: "additional-categories",
      label: "Secondary categories",
      weight: 8,
      passed: profile.additionalCategories.length > 0,
      detail: profile.additionalCategories.length
        ? `${profile.additionalCategories.length} secondary categories.`
        : "Add relevant secondary categories to widen reach.",
    },
    {
      id: "website",
      label: "Website linked",
      weight: 10,
      passed: !!profile.website,
      detail: profile.website
        ? `Links to ${profile.domain ?? profile.website}.`
        : "No website link — add one to drive referral traffic.",
    },
    {
      id: "phone",
      label: "Phone number",
      weight: 8,
      passed: !!profile.phone,
      detail: profile.phone ? "Phone present." : "Add a local phone number.",
    },
    {
      id: "hours",
      label: "Opening hours",
      weight: 10,
      passed: profile.hasHours,
      detail: profile.hasHours
        ? "Opening hours published."
        : "No opening hours — add them so Google can show open/closed status.",
    },
    {
      id: "photos",
      label: "Photos published",
      weight: 12,
      passed: (profile.totalPhotos ?? 0) >= 10,
      detail:
        profile.totalPhotos != null
          ? `${profile.totalPhotos} photos.` +
            ((profile.totalPhotos ?? 0) >= 10
              ? ""
              : " Aim for 10+ across storefront, interior, team, products.")
          : "No photos — add at least 10.",
    },
    {
      id: "reviews-count",
      label: "Review volume",
      weight: 12,
      passed: (profile.reviewsCount ?? 0) >= 25,
      detail:
        profile.reviewsCount != null
          ? `${profile.reviewsCount} reviews.` +
            ((profile.reviewsCount ?? 0) >= 25
              ? ""
              : " Below 25 — run a review-generation push.")
          : "No reviews yet.",
    },
    {
      id: "rating",
      label: "Rating health",
      weight: 8,
      passed: (profile.rating ?? 0) >= 4.2,
      detail:
        profile.rating != null
          ? `${profile.rating.toFixed(1)}★` +
            (profile.rating >= 4.2 ? "" : " — work reviews back above 4.2.")
          : "No rating yet.",
    },
    {
      id: "attributes",
      label: "Attributes set",
      weight: 5,
      passed: profile.attributesCount > 0,
      detail: profile.attributesCount
        ? `${profile.attributesCount} attributes.`
        : "Add attributes (accessibility, amenities, payment).",
    },
  ];

  const score = checks.reduce(
    (sum, check) => sum + (check.passed ? check.weight : 0),
    0,
  );
  const grade =
    score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
  return { score, grade, checks };
}

function businessLocationParams(input: LocalProfileInput) {
  return input.near
    ? { locationCoordinate: formatBusinessDataCoordinate(input.near) }
    : { locationCode: input.locationCode };
}

export type LocalProfileInput = {
  projectId: string;
  keyword: string; // business name, or "cid:..." / "place_id:..."
  near?: { latitude: number; longitude: number; radiusKm?: number };
  locationCode: number;
  languageCode: string;
};

async function getProfile(
  input: LocalProfileInput,
  billingCustomer: BillingCustomerContext,
): Promise<LocalProfileResult> {
  const cacheKey = await buildCacheKey("local:profile", {
    organizationId: billingCustomer.organizationId,
    projectId: input.projectId,
    keyword: input.keyword,
    near: input.near ?? null,
    locationCode: input.locationCode,
    languageCode: input.languageCode,
  });

  const cached = await getCached(cacheKey);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- our own cache entry, shape written by setCached below
  const cachedParsed = cached as LocalProfileResult | null;
  if (cachedParsed && cachedParsed.hasData) return cachedParsed;

  const client = createDataforseoClient(billingCustomer);
  const raw = await client.business.myBusinessInfo({
    keyword: input.keyword,
    languageCode: input.languageCode,
    ...businessLocationParams(input),
  });

  const fetchedAt = new Date().toISOString();
  if (raw == null) {
    return {
      profile: shapeProfile({}),
      scorecard: buildScorecard(shapeProfile({})),
      fetchedAt,
      hasData: false,
    };
  }

  const profile = shapeProfile(raw);
  const result: LocalProfileResult = {
    profile,
    scorecard: buildScorecard(profile),
    fetchedAt,
    hasData: true,
  };
  await setCached(cacheKey, result, PROFILE_TTL_SECONDS);
  return result;
}

export type NearbyListing = {
  title: string | null;
  rating: number | null;
  reviewsCount: number | null;
  category: string | null;
  address: string | null;
  isClaimed: boolean | null;
  cid: string | null;
};

async function getNearbyListings(
  input: {
    projectId: string;
    categories?: string[];
    title?: string;
    near: { latitude: number; longitude: number; radiusKm?: number };
    limit: number;
  },
  billingCustomer: BillingCustomerContext,
): Promise<{ listings: NearbyListing[]; fetchedAt: string }> {
  const cacheKey = await buildCacheKey("local:listings", {
    organizationId: billingCustomer.organizationId,
    projectId: input.projectId,
    categories: input.categories ?? null,
    title: input.title ?? null,
    near: input.near,
    limit: input.limit,
  });
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- our own cache entry, shape written by setCached below
  const cached = (await getCached(cacheKey)) as {
    listings: NearbyListing[];
    fetchedAt: string;
  } | null;
  if (cached) return cached;

  const client = createDataforseoClient(billingCustomer);
  const items = await client.business.businessListings({
    categories: input.categories,
    title: input.title,
    locationCoordinate: formatBusinessDataCoordinate(input.near),
    orderBy: ["rating.value,desc"],
    limit: input.limit,
  });

  const listings: NearbyListing[] = items.map((item) => ({
    title: readString(item, "title"),
    rating: readNumber(item, "rating", "value"),
    reviewsCount: readNumber(item, "rating", "votes_count"),
    category: readString(item, "category"),
    address: readString(item, "address"),
    isClaimed: readBool(item, "is_claimed"),
    cid: readString(item, "cid"),
  }));
  const result = { listings, fetchedAt: new Date().toISOString() };
  await setCached(cacheKey, result, LISTINGS_TTL_SECONDS);
  return result;
}

async function listCategories(): Promise<
  { category: string; businessCount: number | null }[]
> {
  const response = await fetchBusinessListingsCategories();
  return response.data;
}

export const LocalProfileService = {
  getProfile,
  getNearbyListings,
  listCategories,
  shapeProfile,
  buildScorecard,
};
