import { useState } from "react";
import {
  AlertCircle,
  MapPin,
  Star,
  Phone,
  Globe,
  Clock,
  Camera,
  BadgeCheck,
  Loader2,
} from "lucide-react";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { SafeExternalLink } from "@/client/components/SafeExternalLink";
import { RankGridHeatmap } from "@/client/features/local/components/RankGridHeatmap";
import { useLocalRankGridMutation } from "@/client/features/local/hooks/useLocalQueries";
import type { BusinessProfile } from "@/server/features/local/services/LocalProfileService";

export function EmptyState() {
  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body items-center text-center py-12">
        <MapPin className="text-base-content/30" size={40} />
        <p className="font-medium">Look up your business to begin</p>
        <p className="text-sm text-base-content/60 max-w-md">
          Enter a Google Business Profile name. You’ll get an optimization
          score, a map-pack rank grid, review analysis, and nearby competitors.
        </p>
      </div>
    </div>
  );
}

export function ProfileCard({
  profile,
}: {
  profile: BusinessProfile;
}) {
  const rows: { icon: React.ReactNode; label: string; value: React.ReactNode }[] =
    [
      {
        icon: <Star size={15} />,
        label: "Rating",
        value:
          profile.rating != null
            ? `${profile.rating.toFixed(1)}★ (${profile.reviewsCount ?? 0} reviews)`
            : "—",
      },
      {
        icon: <MapPin size={15} />,
        label: "Address",
        value: profile.address ?? "—",
      },
      {
        icon: <Phone size={15} />,
        label: "Phone",
        value: profile.phone ?? "—",
      },
      {
        icon: <Globe size={15} />,
        label: "Website",
        value: profile.website ? (
          <SafeExternalLink
            url={profile.website}
            label={profile.domain ?? profile.website}
            className="link link-primary inline-flex items-center gap-1"
          />
        ) : (
          "—"
        ),
      },
      {
        icon: <Clock size={15} />,
        label: "Status",
        value: profile.currentStatus ?? (profile.hasHours ? "Hours set" : "—"),
      },
      {
        icon: <Camera size={15} />,
        label: "Photos",
        value: profile.totalPhotos ?? "—",
      },
    ];
  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{profile.title ?? "—"}</h2>
            <p className="text-sm text-base-content/60">
              {profile.category ?? "No category"}
            </p>
          </div>
          {profile.isClaimed ? (
            <span className="badge badge-success gap-1">
              <BadgeCheck size={13} /> Claimed
            </span>
          ) : (
            <span className="badge badge-warning">Unclaimed</span>
          )}
        </div>
        {profile.additionalCategories.length ? (
          <div className="flex flex-wrap gap-1.5">
            {profile.additionalCategories.map((c) => (
              <span key={c} className="badge badge-ghost badge-sm">
                {c}
              </span>
            ))}
          </div>
        ) : null}
        <ul className="mt-2 space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-3 text-sm">
              <span className="text-base-content/40">{r.icon}</span>
              <span className="w-20 shrink-0 text-base-content/60">
                {r.label}
              </span>
              <span className="min-w-0 truncate">{r.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function GridTab({
  projectId,
  defaultKeyword,
  target,
  center,
}: {
  projectId: string;
  defaultKeyword: string;
  target: { cid?: string; placeId?: string; name?: string };
  center: { latitude: number; longitude: number } | undefined;
}) {
  const [keyword, setKeyword] = useState(defaultKeyword);
  const [gridSize, setGridSize] = useState<3 | 5>(3);
  const [spacingKm, setSpacingKm] = useState(2);
  const grid = useLocalRankGridMutation(projectId);

  if (!center) {
    return (
      <div className="alert">
        <AlertCircle size={18} />
        <span>
          No storefront coordinate on this profile, so the grid can’t be
          centered. This usually means the business isn’t a physical location.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card bg-base-100 border border-base-300">
        <div className="card-body p-4 gap-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <label className="form-control flex-1">
              <span className="label-text text-xs">Search keyword</span>
              <input
                className="input input-bordered input-sm"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                maxLength={120}
              />
            </label>
            <label className="form-control">
              <span className="label-text text-xs">Grid</span>
              <select
                className="select select-bordered select-sm"
                value={gridSize}
                onChange={(e) => setGridSize(e.target.value === "5" ? 5 : 3)}
              >
                <option value={3}>3×3 (9 pts)</option>
                <option value={5}>5×5 (25 pts)</option>
              </select>
            </label>
            <label className="form-control">
              <span className="label-text text-xs">Spacing km</span>
              <input
                type="number"
                min={0.25}
                max={10}
                step={0.25}
                className="input input-bordered input-sm w-24"
                value={spacingKm}
                onChange={(e) => setSpacingKm(Number(e.target.value))}
              />
            </label>
            <button
              className="btn btn-primary btn-sm"
              disabled={grid.isPending || keyword.trim() === ""}
              onClick={() =>
                grid.mutate({
                  keyword: keyword.trim(),
                  target,
                  center,
                  gridSize,
                  spacingKm,
                  device: "mobile",
                })
              }
            >
              {grid.isPending ? (
                <>
                  <Loader2 className="animate-spin" size={14} /> Running…
                </>
              ) : (
                `Run grid (${gridSize * gridSize} searches)`
              )}
            </button>
          </div>
          <p className="text-xs text-base-content/50">
            Each point is a live Google Maps search and spends credits. 3×3 is
            the sensible default.
          </p>
        </div>
      </div>

      {grid.isError ? (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{getStandardErrorMessage(grid.error)}</span>
        </div>
      ) : null}

      {grid.data ? <RankGridHeatmap result={grid.data} /> : null}
    </div>
  );
}

