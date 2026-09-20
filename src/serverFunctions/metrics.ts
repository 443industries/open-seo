import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  ProjectMetricService,
  METRIC_TYPES,
} from "@/server/features/metrics/services/ProjectMetricService";

const metricTypeSchema = z.enum(METRIC_TYPES);

const scheduleQuerySchema = z.object({
  projectId: z.string().min(1),
  metricType: metricTypeSchema,
});

export const getMetricSchedule = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(scheduleQuerySchema)
  .handler(async ({ data, context }) => {
    const [schedule, trend] = await Promise.all([
      ProjectMetricService.getSchedule(context.projectId, data.metricType),
      ProjectMetricService.getTrend({
        projectId: context.projectId,
        metricType: data.metricType,
      }),
    ]);
    return { schedule, trend };
  });

export const setMetricSchedule = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(
    scheduleQuerySchema.extend({
      interval: z.enum(["daily", "weekly", "monthly", "manual"]),
    }),
  )
  .handler(async ({ data, context }) =>
    ProjectMetricService.setSchedule({
      projectId: context.projectId,
      metricType: data.metricType,
      interval: data.interval,
    }),
  );

export const runMetricSnapshot = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(scheduleQuerySchema)
  .handler(async ({ data, context }) =>
    ProjectMetricService.runSnapshot(
      { projectId: context.projectId, metricType: data.metricType },
      context,
    ),
  );
