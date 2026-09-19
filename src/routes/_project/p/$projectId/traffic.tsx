import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
} from "@tanstack/react-router";
import { z } from "zod";
import { TrafficPage } from "@/client/features/traffic/TrafficPage";

const trafficSearchSchema = z.object({
  domain: z.string().optional(),
  competitors: z.string().optional(),
});

const DEFAULT_SEARCH = { domain: "", competitors: "" } as const;

function parseList(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const Route = createFileRoute("/_project/p/$projectId/traffic")({
  validateSearch: trafficSearchSchema,
  search: {
    middlewares: [stripSearchParams(DEFAULT_SEARCH)],
  },
  component: TrafficRoute,
});

function TrafficRoute() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();

  return (
    <TrafficPage
      projectId={projectId}
      initialDomain={search.domain ?? ""}
      initialCompetitors={parseList(search.competitors ?? "")}
      onChange={(domain, competitors) => {
        void navigate({
          search: () => ({ domain, competitors: competitors.join(", ") }),
          replace: true,
        });
      }}
    />
  );
}
