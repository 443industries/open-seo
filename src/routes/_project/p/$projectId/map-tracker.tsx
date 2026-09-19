import { createFileRoute } from "@tanstack/react-router";
import { MapRankTrackerPage } from "@/client/features/local/MapRankTrackerPage";

export const Route = createFileRoute("/_project/p/$projectId/map-tracker")({
  component: MapRankTrackerRoute,
});

function MapRankTrackerRoute() {
  const { projectId } = Route.useParams();
  return <MapRankTrackerPage projectId={projectId} />;
}
