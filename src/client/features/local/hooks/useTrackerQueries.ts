import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createLocalTracker,
  listLocalTrackers,
  deleteLocalTracker,
  runLocalTracker,
  getLocalTrackerHistory,
} from "@/serverFunctions/local-tracker";

export function useTrackersQuery(projectId: string) {
  return useQuery({
    queryKey: ["local-trackers", projectId],
    queryFn: () => listLocalTrackers({ data: { projectId } }),
    staleTime: 60_000,
  });
}

export function useCreateTrackerMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      label: string;
      keyword: string;
      target: { cid?: string; placeId?: string; name?: string };
      center: { latitude: number; longitude: number };
      gridSize?: 3 | 5;
      spacingKm?: number;
      scheduleInterval?: "daily" | "weekly" | "monthly" | "manual";
    }) => createLocalTracker({ data: { projectId, ...data } }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["local-trackers", projectId] }),
  });
}

export function useDeleteTrackerMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trackerId: string) =>
      deleteLocalTracker({ data: { projectId, trackerId } }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["local-trackers", projectId] }),
  });
}

export function useRunTrackerMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trackerId: string) =>
      runLocalTracker({ data: { projectId, trackerId } }),
    onSuccess: (_res, trackerId) => {
      void qc.invalidateQueries({ queryKey: ["local-trackers", projectId] });
      void qc.invalidateQueries({
        queryKey: ["local-tracker-history", trackerId],
      });
    },
  });
}

export function useTrackerHistoryQuery(
  projectId: string,
  trackerId: string | null,
) {
  return useQuery({
    enabled: trackerId != null,
    queryKey: ["local-tracker-history", trackerId],
    queryFn: () =>
      getLocalTrackerHistory({ data: { projectId, trackerId: trackerId! } }),
    staleTime: 30_000,
  });
}
