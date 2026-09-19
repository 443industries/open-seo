import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  useNearbyListingsQuery,
  useBusinessReviewsMutation,
} from "@/client/features/local/hooks/useLocalQueries";

export function ReviewsTab({
  projectId,
  cid,
  businessName,
}: {
  projectId: string;
  cid?: string;
  businessName: string;
}) {
  const reviews = useBusinessReviewsMutation(projectId);
  const [collected, setCollected] = useState<
    | {
        rating: number | null;
        author: string | null;
        text: string | null;
        when: string | null;
        ownerAnswer: string | null;
      }[]
    | null
  >(null);
  const [pollTaskId, setPollTaskId] = useState<string | null>(null);

  function start() {
    setCollected(null);
    setPollTaskId(null);
    reviews.mutate(
      { businessName: cid ? undefined : businessName, cid, depth: 50, sortBy: "newest" },
      {
        onSuccess: (res) => {
          if (res.status === "processing") setPollTaskId(res.taskId);
          else setCollected(res.reviews);
        },
      },
    );
  }

  // Poll every 4s while a task is pending.
  useEffect(() => {
    if (!pollTaskId) return;
    const timer = setTimeout(() => {
      reviews.mutate(
        { taskId: pollTaskId },
        {
          onSuccess: (res) => {
            if (res.status === "processing") setPollTaskId(res.taskId);
            else {
              setCollected(res.reviews);
              setPollTaskId(null);
            }
          },
        },
      );
    }, 4000);
    return () => clearTimeout(timer);
  }, [pollTaskId, reviews]);

  const unanswered = useMemo(
    () => collected?.filter((r) => !r.ownerAnswer).length ?? 0,
    [collected],
  );
  const busy = reviews.isPending || pollTaskId != null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button className="btn btn-primary btn-sm" onClick={start} disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="animate-spin" size={14} /> Collecting…
            </>
          ) : (
            "Collect latest reviews"
          )}
        </button>
        {collected ? (
          <span className="text-sm text-base-content/60">
            {collected.length} reviews · {unanswered} unanswered by owner
          </span>
        ) : null}
      </div>

      {reviews.isError ? (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{getStandardErrorMessage(reviews.error)}</span>
        </div>
      ) : null}

      {collected?.length ? (
        <ul className="space-y-3">
          {collected.map((r, i) => (
            <li
              key={i}
              className="card bg-base-100 border border-base-300"
            >
              <div className="card-body p-4 gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">
                    {r.author ?? "Anonymous"}
                  </span>
                  <span className="text-xs text-base-content/50">{r.when}</span>
                </div>
                <div className="text-warning text-sm">
                  {r.rating != null ? "★".repeat(Math.round(r.rating)) : ""}
                </div>
                {r.text ? <p className="text-sm">{r.text}</p> : null}
                {r.ownerAnswer ? (
                  <p className="text-xs text-base-content/60 border-l-2 border-base-300 pl-2 mt-1">
                    Owner: {r.ownerAnswer}
                  </p>
                ) : (
                  <span className="badge badge-warning badge-sm mt-1 w-fit">
                    Needs a reply
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : collected ? (
        <p className="text-sm text-base-content/60">No reviews found.</p>
      ) : null}
    </div>
  );
}

export function CompetitorsTab({
  projectId,
  category,
  center,
  selfTitle,
}: {
  projectId: string;
  category: string | null;
  center: { latitude: number; longitude: number } | undefined;
  selfTitle: string | null;
}) {
  const listings = useNearbyListingsQuery({
    projectId,
    categories: category ? [category] : undefined,
    near: center,
    enabled: true,
  });

  if (!center) {
    return (
      <div className="alert">
        <AlertCircle size={18} />
        <span>No coordinate to search competitors from.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-base-content/60">
        Businesses near your storefront{category ? ` in “${category}”` : ""},
        ranked by rating.
      </p>
      {listings.isLoading ? (
        <div className="flex items-center gap-2 text-base-content/60 py-6 justify-center">
          <Loader2 className="animate-spin" size={16} /> Loading competitors…
        </div>
      ) : listings.isError ? (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{getStandardErrorMessage(listings.error)}</span>
        </div>
      ) : listings.data?.listings.length ? (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Business</th>
                <th>Rating</th>
                <th>Reviews</th>
                <th>Category</th>
                <th>Claimed</th>
              </tr>
            </thead>
            <tbody>
              {listings.data.listings.map((l, i) => {
                const isSelf =
                  selfTitle != null &&
                  l.title?.toLowerCase() === selfTitle.toLowerCase();
                return (
                  <tr key={i} className={isSelf ? "bg-primary/10" : ""}>
                    <td className="font-medium">
                      {l.title ?? "—"}
                      {isSelf ? (
                        <span className="badge badge-primary badge-xs ml-2">
                          You
                        </span>
                      ) : null}
                    </td>
                    <td>{l.rating != null ? `${l.rating.toFixed(1)}★` : "—"}</td>
                    <td>{l.reviewsCount ?? "—"}</td>
                    <td className="text-xs">{l.category ?? "—"}</td>
                    <td>
                      {l.isClaimed == null ? "—" : l.isClaimed ? "Yes" : "No"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-base-content/60">No nearby listings found.</p>
      )}
    </div>
  );
}
