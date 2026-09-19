import { useState, type FormEvent } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { useCreateTrackerMutation } from "@/client/features/local/hooks/useTrackerQueries";

export function CreateTrackerForm({
  projectId,
  onDone,
}: {
  projectId: string;
  onDone: () => void;
}) {
  const create = useCreateTrackerMutation(projectId);
  const [label, setLabel] = useState("");
  const [keyword, setKeyword] = useState("");
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [gridSize, setGridSize] = useState<3 | 5>(3);
  const [scheduleInterval, setScheduleInterval] = useState<
    "daily" | "weekly" | "monthly" | "manual"
  >("weekly");

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        label: label.trim(),
        keyword: keyword.trim(),
        target: { name: name.trim() },
        center: { latitude: Number(lat), longitude: Number(lng) },
        gridSize,
        scheduleInterval,
      },
      { onSuccess: onDone },
    );
  }

  const valid =
    label.trim() &&
    keyword.trim() &&
    name.trim() &&
    lat !== "" &&
    lng !== "" &&
    !Number.isNaN(Number(lat)) &&
    !Number.isNaN(Number(lng));

  return (
    <form onSubmit={submit} className="card bg-base-100 border border-base-300">
      <div className="card-body p-4 gap-3">
        <h3 className="font-semibold text-sm">New tracker</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="form-control">
            <span className="label-text text-xs">Label</span>
            <input
              className="input input-bordered input-sm"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. BJJ near me — Surfers"
            />
          </label>
          <label className="form-control">
            <span className="label-text text-xs">Keyword</span>
            <input
              className="input input-bordered input-sm"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. bjj near me"
            />
          </label>
          <label className="form-control sm:col-span-2">
            <span className="label-text text-xs">
              Business name (as on Google)
            </span>
            <input
              className="input input-bordered input-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="form-control">
            <span className="label-text text-xs">Center latitude</span>
            <input
              className="input input-bordered input-sm"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="-27.9668"
            />
          </label>
          <label className="form-control">
            <span className="label-text text-xs">Center longitude</span>
            <input
              className="input input-bordered input-sm"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="153.4103"
            />
          </label>
          <label className="form-control">
            <span className="label-text text-xs">Grid</span>
            <select
              className="select select-bordered select-sm"
              value={gridSize}
              onChange={(e) => setGridSize(e.target.value === "5" ? 5 : 3)}
            >
              <option value={3}>3×3</option>
              <option value={5}>5×5</option>
            </select>
          </label>
          <label className="form-control">
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
        {create.isError ? (
          <div className="alert alert-error">
            <AlertCircle size={16} />
            <span>{getStandardErrorMessage(create.error)}</span>
          </div>
        ) : null}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onDone}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={!valid || create.isPending}
          >
            {create.isPending ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              "Create tracker"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
