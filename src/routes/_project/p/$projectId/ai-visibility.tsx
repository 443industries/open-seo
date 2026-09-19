import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
} from "@tanstack/react-router";
import { z } from "zod";
import { AiVisibilityPage } from "@/client/features/ai-search/AiVisibilityPage";
import { parseCompetitorList } from "@/types/schemas/ai-search";

const aiVisibilitySearchSchema = z.object({
  q: z.string().optional(),
  competitors: z.string().optional(),
});

const DEFAULT_SEARCH = { q: "", competitors: "" } as const;

export const Route = createFileRoute("/_project/p/$projectId/ai-visibility")({
  validateSearch: aiVisibilitySearchSchema,
  search: {
    middlewares: [stripSearchParams(DEFAULT_SEARCH)],
  },
  component: AiVisibilityRoute,
});

function AiVisibilityRoute() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();

  return (
    <AiVisibilityPage
      projectId={projectId}
      initialQuery={search.q ?? ""}
      initialCompetitors={parseCompetitorList(search.competitors ?? "")}
      onChange={(query, competitors) => {
        void navigate({
          search: () => ({ q: query, competitors: competitors.join(", ") }),
          replace: true,
        });
      }}
    />
  );
}
