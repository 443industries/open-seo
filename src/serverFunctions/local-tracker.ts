import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { LocalGridTrackerService } from "@/server/features/local/services/LocalGridTrackerService";

const createTrackerSchema = z.object({
  projectId: z.string().min(1),
  label: z.string().min(1).max(120),
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
  scheduleInterval: z.enum(["daily", "weekly", "monthly", "manual"]).optional(),
});

const trackerIdSchema = z.object({
  projectId: z.string().min(1),
  trackerId: z.string().min(1).max(64),
});

export const createLocalTracker = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(createTrackerSchema)
  .handler(async ({ data, context }) =>
    LocalGridTrackerService.createTracker({
      projectId: context.projectId,
      label: data.label,
      keyword: data.keyword,
      target: data.target,
      center: data.center,
      gridSize: data.gridSize,
      spacingKm: data.spacingKm,
      device: data.device,
      languageCode: context.project.languageCode,
      scheduleInterval: data.scheduleInterval,
    }),
  );

export const listLocalTrackers = createServerFn({ method: "GET" })
  .middleware(requireProjectContext)
  .validator(z.object({ projectId: z.string().min(1) }))
  .handler(async ({ context }) =>
    LocalGridTrackerService.listTrackers(context.projectId),
  );

export const deleteLocalTracker = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(trackerIdSchema)
  .handler(async ({ data, context }) =>
    LocalGridTrackerService.deleteTracker({
      id: data.trackerId,
      projectId: context.projectId,
    }),
  );

export const runLocalTracker = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(trackerIdSchema)
  .handler(async ({ data, context }) =>
    LocalGridTrackerService.runTracker(
      { trackerId: data.trackerId, projectId: context.projectId },
      context,
    ),
  );

export const getLocalTrackerHistory = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(trackerIdSchema)
  .handler(async ({ data, context }) =>
    LocalGridTrackerService.getTrackerHistory({
      trackerId: data.trackerId,
      projectId: context.projectId,
    }),
  );
