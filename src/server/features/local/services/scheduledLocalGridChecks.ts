import { and, eq, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { localGridTrackers } from "@/db/schema";
import { LocalGridTrackerService } from "@/server/features/local/services/LocalGridTrackerService";
import { getProjectOrganizationId } from "@/server/features/local/services/projectOrg";

// Grids are cheap (9-25 SERP calls) so scheduled trackers run inline in the
// cron tick rather than through a Workflow. Bounded per tick to stay well
// inside the sub-hourly 15-minute cron kill and DataForSEO's rate cap; leftover
// due trackers run next tick (oldest first by nextRunAt).
const MAX_TRACKERS_PER_TICK = 8;

/**
 * Cron body: run every active, scheduled tracker whose nextRunAt is due. Wrapped
 * in withPgClient at the entrypoint (server.ts), mirroring runScheduledRankChecks.
 */
export async function runScheduledLocalGridTrackers(_env: Env) {
  const nowIso = new Date().toISOString();
  const due = await db
    .select()
    .from(localGridTrackers)
    .where(
      and(
        eq(localGridTrackers.isActive, true),
        ne(localGridTrackers.scheduleInterval, "manual"),
        lte(localGridTrackers.nextRunAt, nowIso),
      ),
    )
    .orderBy(localGridTrackers.nextRunAt)
    .limit(MAX_TRACKERS_PER_TICK);

  let ran = 0;
  let errors = 0;
  for (const tracker of due) {
    try {
      const organizationId = await getProjectOrganizationId(tracker.projectId);
      if (!organizationId) continue;
      await LocalGridTrackerService.runTracker(
        { trackerId: tracker.id, projectId: tracker.projectId },
        {
          userId: "system",
          userEmail: "system@openseo.so",
          organizationId,
          projectId: tracker.projectId,
        },
      );
      ran++;
    } catch (err) {
      errors++;
      console.error(
        `[cron] Local grid tracker ${tracker.id} failed:`,
        err,
      );
    }
  }

  (errors > 0 ? console.error : console.log)({
    event: "local_grid_scheduler_summary",
    candidates: due.length,
    ran,
    errors,
  });
}
