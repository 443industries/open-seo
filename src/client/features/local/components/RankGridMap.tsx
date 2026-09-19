import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { GridPointResult } from "@/server/features/local/services/localRankGrid";
// Leaflet's stylesheet is linked globally in routes/__root.tsx (?url pattern).

// Real basemap (OpenStreetMap tiles) with the rank grid overlaid as colored,
// numbered pins — the Semrush map-pack view. Leaflet is loaded client-only via
// dynamic import so the Workers SSR pass (no window) doesn't crash; divIcon pins
// avoid Leaflet's default marker-image asset-path problem.

function pinColor(point: GridPointResult): string {
  if (point.error) return "#6b7280"; // grey
  if (point.rank == null) return "#9ca3af"; // light grey
  if (point.rank <= 3) return "#16a34a"; // green
  if (point.rank <= 10) return "#f59e0b"; // amber
  return "#dc2626"; // red
}

function pinLabel(point: GridPointResult): string {
  if (point.error) return "×";
  if (point.rank == null) return "–";
  return point.rank > 20 ? "20+" : String(point.rank);
}

export function RankGridMap({
  grid,
  center,
  zoom,
}: {
  grid: GridPointResult[];
  center: { latitude: number; longitude: number };
  zoom: number;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  // Leaflet map + marker layer. Types are import-type-only; the runtime module
  // is loaded via dynamic import inside the effect (client-only).
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !elRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(elRef.current, {
          scrollWheelZoom: false,
          attributionControl: true,
        }).setView([center.latitude, center.longitude], Math.min(zoom, 13));
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(mapRef.current);
        layerRef.current = L.layerGroup().addTo(mapRef.current);
      }

      const layer = layerRef.current;
      if (!layer) return;
      layer.clearLayers();

      const latLngs: [number, number][] = [];
      for (const point of grid) {
        const color = pinColor(point);
        const label = pinLabel(point);
        const icon = L.divIcon({
          className: "",
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          html: `<div style="width:30px;height:30px;border-radius:9999px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font:600 12px system-ui;box-shadow:0 1px 3px rgba(0,0,0,.4);border:2px solid #fff">${label}</div>`,
        });
        const marker = L.marker([point.latitude, point.longitude], { icon });
        marker.bindTooltip(
          point.error
            ? "Search failed here"
            : point.rank == null
              ? `Not in top 20 · #1 ${point.topResult?.title ?? "?"}`
              : `Rank ${point.rank} · #1 ${point.topResult?.title ?? "?"}`,
        );
        marker.addTo(layer);
        latLngs.push([point.latitude, point.longitude]);
      }

      if (latLngs.length > 0) {
        mapRef.current.fitBounds(latLngs, { padding: [30, 30] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [grid, center.latitude, center.longitude, zoom]);

  // Tear the map down on unmount so a remount (tab toggle) re-inits cleanly.
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  return (
    <div
      ref={elRef}
      className="h-[420px] w-full rounded-box border border-base-300 z-0"
    />
  );
}
