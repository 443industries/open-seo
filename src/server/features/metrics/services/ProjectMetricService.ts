// Phase 2b: scheduled overview metrics. One generic mechanism (schedule +
// snapshot) for three metric types, each computed by reusing the existing
// services so the scheduled figure matches what the tab shows live:
//   traffic         -> TrafficService.getTraffic (target's organic ETV)
//   domain_overview -> DomainService.getOverview
//   backlinks       -> client.backlinks.summary
// Snapshots store a compact summary for trend charts; runs are cheap enough to
// execute inline in the Worker cron.

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  projectCompetitors,
  projectMetricSchedules,
  projectMetricSnapshots,
} from "@/db/schema";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { createDataforseoClient } from "@/server/lib/dataforseo";
import { TrafficService } from "@/server/features/traffic/services/TrafficService";
import { DomainService } from "@/server/features/domain/services/DomainService";
import { AppError } from "@/server/lib/errors";
import {
  computeNextCheckAt,
  isScheduledRankTrackingInterval,
} from "@/shared/rank-tracking";
import {
  METRIC_TYPES,
  type MetricType,
  type MetricSummary,
} from "@/shared/metrics";

export { METRIC_TYPES };
export type { MetricType, MetricSummary };
type ScheduleInterval = "daily" | "weekly" | "monthly" | "manual";

type ProjectData = {
  organizationId: string;
  domain: string;
  locationCode: number;
  languageCode: string;
  competitors: string[];
};

async function loadProject(projectId: string): Promise<ProjectData> {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) throw new AppError("NOT_FOUND", "Project not found.");
  if (!project.domain) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Set the project's domain before scheduling metrics.",
    );
  }
  const comps = await db
    .select({ domain: projectCompetitors.domain })
    .from(projectCompetitors)
    .where(eq(projectCompetitors.projectId, projectId));
  return {
    organizationId: project.organizationId,
    domain: project.domain,
    locationCode: project.locationCode,
    languageCode: project.languageCode,
    competitors: comps.map((c) => c.domain),
  };
}

async function computeSummary(
  metricType: MetricType,
  projectId: string,
  project: ProjectData,
  billingCustomer: BillingCustomerContext,
): Promise<MetricSummary> {
  if (metricType === "traffic") {
    const result = await TrafficService.getTraffic(
      {
        projectId,
        domain: project.domain,
        competitors: project.competitors,
        locationCode: project.locationCode,
        languageCode: project.languageCode,
      },
      billingCustomer,
    );
    const self = result.competitors.find((c) => c.isTarget);
    return {
      organicEtv: self?.organicEtv ?? null,
      organicKeywords: self?.organicKeywords ?? null,
      competitorCount: result.competitors.length - 1,
    };
  }

  if (metricType === "domain_overview") {
    const overview = await DomainService.getOverview(
      {
        projectId,
        domain: project.domain,
        locationCode: project.locationCode,
        languageCode: project.languageCode,
      },
      billingCustomer,
    );
    return {
      organicTraffic: overview.organicTraffic,
      organicKeywords: overview.organicKeywords,
      backlinks: overview.backlinks,
      referringDomains: overview.referringDomains,
    };
  }

  // backlinks
  const client = createDataforseoClient(billingCustomer);
  const summary = await client.backlinks.summary({
    target: project.domain,
    includeSubdomains: true,
  });
  return {
    backlinks: summary.backlinks ?? null,
    referringDomains: summary.referring_domains ?? null,
    rank: summary.rank ?? null,
  };
}

function nextRunFor(interval: ScheduleInterval): string | null {
  return isScheduledRankTrackingInterval(interval)
    ? computeNextCheckAt(interval)
    : null;
}

async function runSnapshot(
  input: { projectId: string; metricType: MetricType },
  billingCustomer: BillingCustomerContext,
): Promise<{ summary: MetricSummary; capturedAt: string }> {
  const project = await loadProject(input.projectId);
  const summary = await computeSummary(
    input.metricType,
    input.projectId,
    project,
    billingCustomer,
  );
  const capturedAt = new Date().toISOString();
  await db.insert(projectMetricSnapshots).values({
    projectId: input.projectId,
    metricType: input.metricType,
    summaryJson: JSON.stringify(summary),
    capturedAt,
  });
  // Advance the schedule if one exists and is scheduled.
  const [schedule] = await db
    .select()
    .from(projectMetricSchedules)
    .where(
      and(
        eq(projectMetricSchedules.projectId, input.projectId),
        eq(projectMetricSchedules.metricType, input.metricType),
      ),
    )
    .limit(1);
  if (schedule) {
    await db
      .update(projectMetricSchedules)
      .set({
        lastRunAt: capturedAt,
        nextRunAt: isScheduledRankTrackingInterval(schedule.scheduleInterval)
          ? computeNextCheckAt(schedule.scheduleInterval, schedule.nextRunAt)
          : schedule.nextRunAt,
      })
      .where(eq(projectMetricSchedules.id, schedule.id));
  }
  return { summary, capturedAt };
}

async function getSchedule(projectId: string, metricType: MetricType) {
  const [schedule] = await db
    .select()
    .from(projectMetricSchedules)
    .where(
      and(
        eq(projectMetricSchedules.projectId, projectId),
        eq(projectMetricSchedules.metricType, metricType),
      ),
    )
    .limit(1);
  return schedule ?? null;
}

async function setSchedule(input: {
  projectId: string;
  metricType: MetricType;
  interval: ScheduleInterval;
}) {
  const existing = await getSchedule(input.projectId, input.metricType);
  const isActive = input.interval !== "manual";
  const nextRunAt = nextRunFor(input.interval);
  if (existing) {
    await db
      .update(projectMetricSchedules)
      .set({
        scheduleInterval: input.interval,
        isActive,
        nextRunAt,
      })
      .where(eq(projectMetricSchedules.id, existing.id));
  } else {
    await db.insert(projectMetricSchedules).values({
      id: crypto.randomUUID(),
      projectId: input.projectId,
      metricType: input.metricType,
      scheduleInterval: input.interval,
      isActive,
      nextRunAt,
    });
  }
  return { ok: true };
}

export type MetricTrendPoint = {
  capturedAt: string;
  summary: MetricSummary;
};

async function getTrend(input: {
  projectId: string;
  metricType: MetricType;
  limit?: number;
}): Promise<MetricTrendPoint[]> {
  const rows = await db
    .select()
    .from(projectMetricSnapshots)
    .where(
      and(
        eq(projectMetricSnapshots.projectId, input.projectId),
        eq(projectMetricSnapshots.metricType, input.metricType),
      ),
    )
    .orderBy(desc(projectMetricSnapshots.capturedAt))
    .limit(input.limit ?? 60);
  return rows.map((row) => ({
    capturedAt: row.capturedAt,
    summary: parseSummary(row.summaryJson),
  }));
}

function parseSummary(json: string): MetricSummary {
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- our own summaryJson, written by runSnapshot
      return parsed as MetricSummary;
    }
    return {};
  } catch {
    return {};
  }
}

export const ProjectMetricService = {
  runSnapshot,
  getSchedule,
  setSchedule,
  getTrend,
};
