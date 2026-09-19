// Local rank grid compute — one Google Maps SERP per point of a square grid
// around a coordinate, reporting where a target business ranks at each point.
//
// Extracted from the get_local_rank_grid MCP tool so the same algorithm backs
// three callers: the MCP tool, the Local SEO dashboard's one-shot grid
// (serverFunctions/local.ts), and the persisted Map Rank Tracker's scheduled
// snapshots (features/rank-tracking). Single source of truth for the geometry,
// zoom derivation, matching, and summary maths.

import { AppError } from "@/server/lib/errors";
import type { createDataforseoClient } from "@/server/lib/dataforseo";
import { readPath } from "@/server/mcp/table";
import { formatLocalSerpCoordinate } from "@/server/mcp/tools/local-seo-shared";

type DataforseoClient = ReturnType<typeof createDataforseoClient>;

// Degrees per kilometre. Longitude degrees shrink with latitude; the cosine is
// floored so a near-polar center can't blow the spacing up.
const KM_PER_DEGREE_LATITUDE = 110.574;
const KM_PER_DEGREE_LONGITUDE = 111.32;
const MIN_LONGITUDE_COSINE = 0.01;
const RANK_GRID_DEPTH = 20;
const RANK_GRID_CONCURRENCY = 3;
// Without an explicit zoom DataForSEO infers one per coordinate, which yields
// "No Search Results" for some points and makes ranks incomparable across the
// grid. A fixed zoom fails the other way: a mobile viewport at zoom 14 spans
// only ~±1.5 km east-west at mid latitudes, so a business one 2-3 km grid step
// to the side falls outside the viewport and reads as "not ranked". Derive the
// zoom from the spacing instead: a world tile is 40075·cos(lat)/2^z km wide and
// a portrait viewport ~1.5 tiles, so the largest zoom whose viewport still
// spans ~1.25× the spacing is log2(24045·cos(lat)/spacing).
const RANK_GRID_ZOOM_NUMERATOR_KM = 24045;
const MIN_RANK_GRID_ZOOM = 4;
const MAX_RANK_GRID_ZOOM = 18;

export function rankGridZoom(spacingKm: number, latitude: number): number {
  const cosine = Math.max(
    Math.abs(Math.cos((latitude * Math.PI) / 180)),
    MIN_LONGITUDE_COSINE,
  );
  const zoom = Math.floor(
    Math.log2((RANK_GRID_ZOOM_NUMERATOR_KM * cosine) / spacingKm),
  );
  return Math.min(MAX_RANK_GRID_ZOOM, Math.max(MIN_RANK_GRID_ZOOM, zoom));
}

export type GridPoint = {
  row: number;
  col: number;
  latitude: number;
  longitude: number;
};

export type GridPointResult = GridPoint & {
  rank: number | null;
  // How many businesses the SERP returned there, and who ranked first: a null
  // rank with a full result set means outranked; with a near-empty one it means
  // a sparse SERP. Both absent when the point's search failed.
  resultsCount?: number;
  topResult?: { title: string | null; cid: string | null } | null;
  error?: boolean;
};

export type LocalRankGridSummary = {
  pointsSearched: number;
  pointsFound: number;
  averageRank: number | null;
  top3Count: number;
  top10Count: number;
};

export type LocalRankGridResult = {
  grid: GridPointResult[];
  summary: LocalRankGridSummary;
  matchedBusiness: {
    title: string | null;
    cid: string | null;
    placeId: string | null;
  } | null;
  gridSize: number;
  spacingKm: number;
  zoom: number;
};

export type LocalRankGridInput = {
  keyword: string;
  target: { cid?: string; placeId?: string; name?: string };
  center: { latitude: number; longitude: number };
  gridSize?: 3 | 5;
  spacingKm?: number;
  device?: "desktop" | "mobile";
  zoom?: number;
  languageCode: string;
};

function readString(source: unknown, key: string): string | null {
  const value = readPath(source, key);
  return typeof value === "string" ? value : null;
}

export function buildRankGridPoints(
  center: { latitude: number; longitude: number },
  gridSize: number,
  spacingKm: number,
): GridPoint[] {
  const middle = (gridSize - 1) / 2;
  const latitudeStep = spacingKm / KM_PER_DEGREE_LATITUDE;
  const longitudeStep =
    spacingKm /
    (KM_PER_DEGREE_LONGITUDE *
      Math.max(
        Math.abs(Math.cos((center.latitude * Math.PI) / 180)),
        MIN_LONGITUDE_COSINE,
      ));

  const points: GridPoint[] = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      points.push({
        row,
        col,
        // Row 0 is the northernmost line so the rendered grid reads like a map.
        latitude: Number(
          (center.latitude + (middle - row) * latitudeStep).toFixed(7),
        ),
        longitude: Number(
          (center.longitude + (col - middle) * longitudeStep).toFixed(7),
        ),
      });
    }
  }
  return points;
}

export function matchGridItem(
  items: unknown[],
  target: { cid?: string; placeId?: string; name?: string },
) {
  const name = target.name?.toLowerCase();
  return items.find((item) => {
    if (target.cid != null && readPath(item, "cid") === target.cid) return true;
    if (target.placeId != null && readPath(item, "place_id") === target.placeId)
      return true;
    if (name == null) return false;
    const title = readPath(item, "title");
    return typeof title === "string" && title.toLowerCase().includes(name);
  });
}

// A per-point failure usually means only that point's SERP failed, but these
// codes mean every remaining call would fail (and possibly bill) the same way —
// surface them instead of rendering a misleading grid.
const GRID_ABORT_ERROR_CODES = new Set<string>([
  "INSUFFICIENT_CREDITS",
  "DATAFORSEO_AUTH_FAILED",
]);

/** ASCII grid ("–" = not found, "x" = errored), north at the top. */
export function renderGrid(
  results: GridPointResult[],
  gridSize: number,
): string {
  const lines: string[] = [];
  for (let row = 0; row < gridSize; row++) {
    const cells = results
      .slice(row * gridSize, (row + 1) * gridSize)
      .map((point) =>
        (point.error ? "x" : (point.rank?.toString() ?? "–")).padStart(2, " "),
      );
    lines.push(cells.join(" "));
  }
  return lines.join("\n");
}

/**
 * Runs the grid. Takes an already-metered DataForSEO client so both the MCP
 * context (context.billing) and the server-function context (the billing
 * customer itself) can drive it. Throws on systemic failures (auth, balance)
 * so callers don't persist or render a misleading empty grid.
 */
export async function computeLocalRankGrid(
  client: DataforseoClient,
  input: LocalRankGridInput,
): Promise<LocalRankGridResult> {
  if (
    input.target.cid == null &&
    input.target.placeId == null &&
    input.target.name == null
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "target needs at least one of cid, placeId, or name.",
    );
  }

  const gridSize = input.gridSize ?? 3;
  const spacingKm = input.spacingKm ?? 2;
  const zoom = input.zoom ?? rankGridZoom(spacingKm, input.center.latitude);
  const points = buildRankGridPoints(input.center, gridSize, spacingKm);

  let matchedBusiness: LocalRankGridResult["matchedBusiness"] = null;
  let lastError: unknown = null;

  const searchPoint = async (point: GridPoint): Promise<GridPointResult> => {
    try {
      const items = await client.serp.local({
        keyword: input.keyword,
        locationCoordinate: formatLocalSerpCoordinate({ ...point, zoom }),
        languageCode: input.languageCode,
        searchType: "maps",
        device: input.device ?? "mobile",
        depth: RANK_GRID_DEPTH,
        searchPlaces: false,
      });
      const match = matchGridItem(items, input.target);
      if (match && !matchedBusiness) {
        matchedBusiness = {
          title: readString(match, "title"),
          cid: readString(match, "cid"),
          placeId: readString(match, "place_id"),
        };
      }
      const rank =
        readPath(match, "rank_absolute") ?? readPath(match, "rank_group");
      const first = items[0];
      return {
        ...point,
        rank: typeof rank === "number" ? rank : null,
        resultsCount: items.length,
        topResult:
          first == null
            ? null
            : {
                title: readString(first, "title"),
                cid: readString(first, "cid"),
              },
      };
    } catch (error) {
      if (error instanceof AppError && GRID_ABORT_ERROR_CODES.has(error.code))
        throw error;
      lastError = error;
      return { ...point, rank: null, error: true };
    }
  };

  // A few points at a time; an abort-worthy failure rejects its batch and stops
  // later batches from dispatching (and billing).
  const grid: GridPointResult[] = [];
  for (let i = 0; i < points.length; i += RANK_GRID_CONCURRENCY) {
    const batch = points.slice(i, i + RANK_GRID_CONCURRENCY);
    grid.push(...(await Promise.all(batch.map(searchPoint))));
  }

  // Every point failing means a systemic failure (auth, balance, bad market),
  // not a business that simply doesn't rank — surface it.
  if (grid.every((point) => point.error)) throw lastError;

  const found = grid.filter((point) => point.rank != null);
  const ranks = found.map((point) => point.rank ?? 0);
  const summary: LocalRankGridSummary = {
    pointsSearched: grid.length,
    pointsFound: found.length,
    averageRank: ranks.length
      ? Number(
          (ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length).toFixed(
            2,
          ),
        )
      : null,
    top3Count: ranks.filter((rank) => rank <= 3).length,
    top10Count: ranks.filter((rank) => rank <= 10).length,
  };

  return { grid, summary, matchedBusiness, gridSize, spacingKm, zoom };
}

export { RANK_GRID_DEPTH };
