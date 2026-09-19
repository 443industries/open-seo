import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, Loader2, Search, CheckCircle2 } from "lucide-react";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { useCreateTrackerMutation } from "@/client/features/local/hooks/useTrackerQueries";
import { useLocalProfileQuery } from "@/client/features/local/hooks/useLocalQueries";

export function CreateTrackerForm({
  projectId,
  onDone,
}: {
  projectId: string;
  onDone: () => void;
}) {
  const create = useCreateTrackerMutation(projectId);

  // Step 1: resolve the business (locks cid + coordinates).
  const [nameInput, setNameInput] = useState("");
  const [lookupName, setLookupName] = useState("");
  const profileQuery = useLocalProfileQuery({
    projectId,
    businessName: lookupName,
  });
  const profile =
    profileQuery.data?.hasData === true ? profileQuery.data.profile : null;
  const hasCoords =
    profile?.latitude != null && profile?.longitude != null;

  // Step 2: tracker details (prefilled from the resolved business).
  const [keyword, setKeyword] = useState("");
  const [label, setLabel] = useState("");
  const [gridSize, setGridSize] = useState<3 | 5>(5);
  const [spacingKm, setSpacingKm] = useState(1.2);
  const [scheduleInterval, setScheduleInterval] = useState<
    "daily" | "weekly" | "monthly" | "manual"
  >("weekly");
  // Prefill keyword/label when a business resolves (only fills empties, so it
  // won't clobber the operator's edits).
  const resolvedKey = profile ? (profile.cid ?? profile.title) : null;
  useEffect(() => {
    if (!profile) return;
    if (profile.category) setKeyword((k) => k || (profile.category ?? ""));
    setLabel((l) => l || (profile.title ?? ""));
    // Keyed on the resolved business, not the whole profile object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedKey]);

  function lookUp(e: FormEvent) {
    e.preventDefault();
    setLookupName(nameInput.trim());
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!profile || !hasCoords) return;
    create.mutate(
      {
        label: label.trim() || (profile.title ?? lookupName),
        keyword: keyword.trim(),
        target: {
          cid: profile.cid ?? undefined,
          placeId: profile.placeId ?? undefined,
          name: profile.title ?? lookupName,
        },
        center: { latitude: profile.latitude!, longitude: profile.longitude! },
        gridSize,
        spacingKm,
        scheduleInterval,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body p-4 gap-3">
        <h3 className="font-semibold text-sm">New tracker</h3>

        {/* Step 1 — business lookup */}
        <form onSubmit={lookUp} className="flex gap-2">
          <input
            className="input input-bordered input-sm flex-1"
            placeholder="Business name as on Google (e.g. Gracie Barra Surfers Paradise)"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={200}
          />
          <button
            type="submit"
            className="btn btn-sm"
            disabled={profileQuery.isFetching || !nameInput.trim()}
          >
            {profileQuery.isFetching ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Search size={14} />
            )}
            Look up
          </button>
        </form>

        {profileQuery.isError ? (
          <div className="alert alert-error">
            <AlertCircle size={16} />
            <span>{getStandardErrorMessage(profileQuery.error)}</span>
          </div>
        ) : null}

        {lookupName && profileQuery.data && !profileQuery.data.hasData ? (
          <div className="alert">
            <AlertCircle size={16} />
            <span>
              No Google Business Profile found for “{lookupName}”. Try the exact
              name shown on Google Maps.
            </span>
          </div>
        ) : null}

        {profile ? (
          <>
            <div className="rounded-box border border-success/40 bg-success/5 p-3 flex items-start gap-2">
              <CheckCircle2 className="text-success shrink-0" size={18} />
              <div className="text-sm min-w-0">
                <p className="font-medium truncate">{profile.title}</p>
                <p className="text-xs text-base-content/60 truncate">
                  {profile.address ?? "—"}
                  {profile.rating != null
                    ? ` · ${profile.rating.toFixed(1)}★`
                    : ""}
                </p>
                {hasCoords ? (
                  <p className="text-xs text-base-content/50">
                    Coordinates locked: {profile.latitude!.toFixed(5)},{" "}
                    {profile.longitude!.toFixed(5)}
                    {profile.cid ? ` · cid ${profile.cid}` : ""}
                  </p>
                ) : (
                  <p className="text-xs text-error">
                    This profile has no storefront coordinate — a grid can’t be
                    centered on it.
                  </p>
                )}
              </div>
            </div>

            {/* Step 2 — tracker details */}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="form-control">
                <span className="label-text text-xs">Keyword</span>
                <input
                  className="input input-bordered input-sm"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g. bjj near me"
                />
              </label>
              <label className="form-control">
                <span className="label-text text-xs">Label</span>
                <input
                  className="input input-bordered input-sm"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </label>
              <label className="form-control">
                <span className="label-text text-xs">Grid</span>
                <select
                  className="select select-bordered select-sm"
                  value={gridSize}
                  onChange={(e) => setGridSize(e.target.value === "3" ? 3 : 5)}
                >
                  <option value={5}>5×5 (25 pts)</option>
                  <option value={3}>3×3 (9 pts)</option>
                </select>
              </label>
              <label className="form-control">
                <span className="label-text text-xs">Spacing km</span>
                <input
                  type="number"
                  min={0.25}
                  max={10}
                  step={0.05}
                  className="input input-bordered input-sm"
                  value={spacingKm}
                  onChange={(e) => setSpacingKm(Number(e.target.value))}
                />
              </label>
              <label className="form-control sm:col-span-2">
                <span className="label-text text-xs">Schedule</span>
                <select
                  className="select select-bordered select-sm"
                  value={scheduleInterval}
                  onChange={(e) => {
                    const v = e.target.value;
                    setScheduleInterval(
                      v === "daily" || v === "monthly" || v === "manual"
                        ? v
                        : "weekly",
                    );
                  }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="manual">Manual only</option>
                </select>
              </label>
            </div>
          </>
        ) : null}

        {create.isError ? (
          <div className="alert alert-error">
            <AlertCircle size={16} />
            <span>{getStandardErrorMessage(create.error)}</span>
          </div>
        ) : null}

        <div className="flex gap-2 justify-end">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={
              !profile || !hasCoords || !keyword.trim() || create.isPending
            }
            onClick={submit}
          >
            {create.isPending ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              "Create tracker"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
