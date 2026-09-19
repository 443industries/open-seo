// Persisted Map Rank Tracker. A tracker = one keyword + target business +
// storefront-centered grid; each run stores a snapshot (Avg Rank, coverage,
// top-3/10, full grid JSON) so visibility can be charted over time. Runs happen
// on demand (run-now) or on a schedule (scanned by runScheduledLocalGridTrackers
// in the Worker cron). Reuses computeLocalRankGrid + the rank-tracking interval
// maths so the local tracker behaves like the keyword tracker.

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { localGridTrackers, localGridSnapshots } from "@/db/schema";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { createDataforseoClient } from "@/server/lib/dataforseo";
import {
  computeLocalRankGrid,
  type LocalRankGridResult,
} from "@/server/features/local/services/localRankGrid";
import { AppError } from "@/server/lib/errors";
import {
  computeNextCheckAt,
  isScheduledRankTrackingInterval,
} from "@/shared/rank-tracking";

type ScheduleInterval = "daily" | "weekly" | "monthly" | "manual";

export type CreateTrackerInput = {
  projectId: string;
  label: string;
  keyword: string;
  target: { cid?: string; placeId?: string; name?: string };
  center: { latitude: number; longitude: number };
  gridSize?: 3 | 5;
  spacingKm?: number;
  device?: "desktop" | "mobile";
  languageCode: string;
  scheduleInterval?: ScheduleInterval;
};

function nextRunFor(interval: ScheduleInterval): string | null {
  return isScheduledRankTrackingInterval(interval)
    ? computeNextCheckAt(interval)
    : null;
}

async function createTracker(input: CreateTrackerInput) {
  if (
    input.target.cid == null &&
    input.target.placeId == null &&
    input.target.name == null
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "A tracker needs a target business (cid, placeId, or name).",
    );
  }
  const id = crypto.randomUUID();
  const interval = input.scheduleInterval ?? "weekly";
  await db.insert(localGridTrackers).values({
    id,
    projectId: input.projectId,
    label: input.label,
    keyword: input.keyword,
    targetCid: input.target.cid ?? null,
    targetPlaceId: input.target.placeId ?? null,
    targetName: input.target.name ?? null,
    centerLat: input.center.latitude,
    centerLng: input.center.longitude,
    gridSize: input.gridSize ?? 3,
    spacingKm: input.spacingKm ?? 2,
    device: input.device ?? "mobile",
    languageCode: input.languageCode,
    scheduleInterval: interval,
    nextRunAt: nextRunFor(interval),
  });
  return { id };
}

async function listTrackers(projectId: string) {
  const trackers = await db
    .select()
    .from(localGridTrackers)
    .where(eq(localGridTrackers.projectId, projectId))
    .orderBy(desc(localGridTrackers.createdAt));

  // Attach the latest snapshot per tracker for the list view.
  const withLatest = await Promise.all(
    trackers.map(async (tracker) => {
      const [latest] = await db
        .select()
        .from(localGridSnapshots)
        .where(eq(localGridSnapshots.trackerId, tracker.id))
        .orderBy(desc(localGridSnapshots.capturedAt))
        .limit(1);
      return { tracker, latest: latest ?? null };
    }),
  );
  return withLatest;
}

async function deleteTracker(input: { id: string; projectId: string }) {
  await db
    .delete(localGridTrackers)
    .where(
      and(
        eq(localGridTrackers.id, input.id),
        eq(localGridTrackers.projectId, input.projectId),
      ),
    );
  return { ok: true };
}

async function loadTracker(id: string, projectId: string) {
  const [tracker] = await db
    .select()
    .from(localGridTrackers)
    .where(
      and(
        eq(localGridTrackers.id, id),
        eq(localGridTrackers.projectId, projectId),
      ),
    )
    .limit(1);
  if (!tracker) {
    throw new AppError("NOT_FOUND", "Tracker not found.");
  }
  return tracker;
}

/** Runs the grid now and stores a snapshot. Shared by run-now + the scheduler. */
async function runTracker(
  input: { trackerId: string; projectId: string },
  billingCustomer: BillingCustomerContext,
): Promise<{ result: LocalRankGridResult; snapshotId: number }> {
  const tracker = await loadTracker(input.trackerId, input.projectId);
  const client = createDataforseoClient(billingCustomer);
  const result = await computeLocalRankGrid(client, {
    keyword: tracker.keyword,
    target: {
      cid: tracker.targetCid ?? undefined,
      placeId: tracker.targetPlaceId ?? undefined,
      name: tracker.targetName ?? undefined,
    },
    center: { latitude: tracker.centerLat, longitude: tracker.centerLng },
    gridSize: tracker.gridSize === 5 ? 5 : 3,
    spacingKm: tracker.spacingKm,
    device: tracker.device,
    languageCode: tracker.languageCode,
  });

  const [snapshot] = await db
    .insert(localGridSnapshots)
    .values({
      trackerId: tracker.id,
      avgRank: result.summary.averageRank,
      pointsFound: result.summary.pointsFound,
      pointsSearched: result.summary.pointsSearched,
      top3Count: result.summary.top3Count,
      top10Count: result.summary.top10Count,
      zoom: result.zoom,
      gridJson: JSON.stringify(result.grid),
    })
    .returning({ id: localGridSnapshots.id });

  const nowIso = new Date().toISOString();
  await db
    .update(localGridTrackers)
    .set({
      lastRunAt: nowIso,
      nextRunAt: isScheduledRankTrackingInterval(tracker.scheduleInterval)
        ? computeNextCheckAt(tracker.scheduleInterval, tracker.nextRunAt)
        : tracker.nextRunAt,
    })
    .where(eq(localGridTrackers.id, tracker.id));

  return { result, snapshotId: snapshot?.id ?? 0 };
}

export type TrackerSnapshot = {
  id: number;
  avgRank: number | null;
  pointsFound: number;
  pointsSearched: number;
  top3Count: number;
  top10Count: number;
  zoom: number | null;
  capturedAt: string;
  grid: LocalRankGridResult["grid"];
};

async function getTrackerHistory(input: {
  trackerId: string;
  projectId: string;
  limit?: number;
}) {
  const tracker = await loadTracker(input.trackerId, input.projectId);
  const rows = await db
    .select()
    .from(localGridSnapshots)
    .where(eq(localGridSnapshots.trackerId, tracker.id))
    .orderBy(desc(localGridSnapshots.capturedAt))
    .limit(input.limit ?? 60);

  const snapshots: TrackerSnapshot[] = rows.map((row) => ({
    id: row.id,
    avgRank: row.avgRank,
    pointsFound: row.pointsFound,
    pointsSearched: row.pointsSearched,
    top3Count: row.top3Count,
    top10Count: row.top10Count,
    zoom: row.zoom,
    capturedAt: row.capturedAt,
    grid: safeParseGrid(row.gridJson),
  }));
  return { tracker, snapshots };
}

function safeParseGrid(json: string): LocalRankGridResult["grid"] {
  try {
    const parsed: unknown = JSON.parse(json);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- our own gridJson, written by runTracker via JSON.stringify(result.grid)
    return Array.isArray(parsed) ? (parsed as LocalRankGridResult["grid"]) : [];
  } catch {
    return [];
  }
}

export const LocalGridTrackerService = {
  createTracker,
  listTrackers,
  deleteTracker,
  runTracker,
  getTrackerHistory,
};
