import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getLocalProfile,
  getNearbyListings,
  getLocalRankGrid,
  getBusinessReviews,
} from "@/serverFunctions/local";

type ProfileInput = {
  projectId: string;
  businessName: string;
  near?: { latitude: number; longitude: number; radiusKm?: number };
};

/** Business profile + optimization scorecard. Enabled once a name is entered. */
export function useLocalProfileQuery(input: ProfileInput) {
  const name = input.businessName.trim();
  return useQuery({
    enabled: name !== "",
    queryKey: ["local-profile", input.projectId, name, input.near ?? null],
    queryFn: () =>
      getLocalProfile({
        data: {
          projectId: input.projectId,
          businessName: name,
          near: input.near,
        },
      }),
    staleTime: 5 * 60_000,
  });
}

/** Nearby competitor listings by category near the storefront. */
export function useNearbyListingsQuery(input: {
  projectId: string;
  categories?: string[];
  near?: { latitude: number; longitude: number };
  enabled: boolean;
}) {
  return useQuery({
    enabled: input.enabled && input.near != null,
    queryKey: [
      "local-listings",
      input.projectId,
      input.categories ?? null,
      input.near ?? null,
    ],
    queryFn: () =>
      getNearbyListings({
        data: {
          projectId: input.projectId,
          categories: input.categories,
          near: input.near!,
          limit: 20,
        },
      }),
    staleTime: 30 * 60_000,
  });
}

/** Runs a one-shot local rank grid. A mutation — each run spends credits. */
export function useLocalRankGridMutation(projectId: string) {
  return useMutation({
    mutationFn: (data: {
      keyword: string;
      target: { cid?: string; placeId?: string; name?: string };
      center: { latitude: number; longitude: number };
      gridSize?: 3 | 5;
      spacingKm?: number;
      device?: "desktop" | "mobile";
    }) => getLocalRankGrid({ data: { projectId, ...data } }),
  });
}

/** Posts a reviews task, then polls with the returned taskId until completed. */
export function useBusinessReviewsMutation(projectId: string) {
  return useMutation({
    mutationFn: (data: {
      businessName?: string;
      cid?: string;
      placeId?: string;
      depth?: number;
      sortBy?: "newest" | "highest_rating" | "lowest_rating";
      taskId?: string;
    }) => getBusinessReviews({ data: { projectId, ...data } }),
  });
}
