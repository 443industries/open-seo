import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { TrafficService } from "@/server/features/traffic/services/TrafficService";

const trafficSchema = z.object({
  projectId: z.string().min(1),
  domain: z.string().min(1).max(253),
  competitors: z.array(z.string().min(1).max(253)).max(9).default([]),
  locationCode: z.number().int().optional(),
  languageCode: z.string().min(2).max(10).optional(),
});

export const getTraffic = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(trafficSchema)
  .handler(async ({ data, context }) =>
    TrafficService.getTraffic(
      {
        projectId: context.projectId,
        domain: data.domain,
        competitors: data.competitors,
        locationCode: data.locationCode ?? context.project.locationCode,
        languageCode: data.languageCode ?? context.project.languageCode,
      },
      context,
    ),
  );
