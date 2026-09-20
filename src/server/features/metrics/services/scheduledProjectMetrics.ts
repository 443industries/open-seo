import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { projectMetricSchedules } from "@/db/schema";
import { ProjectMetricService } from "@/server/features/metrics/services/ProjectMetricService";
import { getProjectOrganizationId } from "@/server/features/local/services/projectOrg";

// Overview-metric snapshots are single API calls, so due schedules run inline in
// the cron tick. Bounded per tick; leftover due schedules run next tick.
const MAX_PER_TICK = 12;

/**
 * Cron body: run every active, scheduled overview metric whose nextRunAt is due.
 * Wrapped in withPgClient at the entrypoint (server.ts).
 */
export async function runScheduledProjectMetrics(_env: Env) {
  const nowIso = new Date().toISOString();
  const due = await db
    .select()
    .from(projectMetricSchedules)
    .where(
      and(
        eq(projectMetricSchedules.isActive, true),
        lte(projectMetricSchedules.nextRunAt, nowIso),
      ),
    )
    .orderBy(projectMetricSchedules.nextRunAt)
    .limit(MAX_PER_TICK);

  let ran = 0;
  let errors = 0;
  for (const schedule of due) {
    try {
      const organizationId = await getProjectOrganizationId(schedule.projectId);
      if (!organizationId) continue;
      await ProjectMetricService.runSnapshot(
        { projectId: schedule.projectId, metricType: schedule.metricType },
        {
          userId: "system",
          userEmail: "system@openseo.so",
          organizationId,
          projectId: schedule.projectId,
        },
      );
      ran++;
    } catch (err) {
      errors++;
      console.error(
        `[cron] Project metric ${schedule.metricType} for ${schedule.projectId} failed:`,
        err,
      );
    }
  }

  (errors > 0 ? console.error : console.log)({
    event: "project_metrics_scheduler_summary",
    candidates: due.length,
    ran,
    errors,
  });
}
