import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
} from "@tanstack/react-router";
import { LocalSeoPage } from "@/client/features/local/LocalSeoPage";
import { localSearchSchema } from "@/types/schemas/local";

const DEFAULT_LOCAL_SEARCH = {
  businessName: "",
  cid: "",
  tab: "overview",
} as const;

export const Route = createFileRoute("/_project/p/$projectId/local")({
  validateSearch: localSearchSchema,
  search: {
    middlewares: [stripSearchParams(DEFAULT_LOCAL_SEARCH)],
  },
  component: LocalSeoRoute,
});

function LocalSeoRoute() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();

  return (
    <LocalSeoPage
      projectId={projectId}
      initialBusiness={search.businessName ?? ""}
      initialTab={search.tab ?? "overview"}
      onChange={(businessName, tab) => {
        void navigate({
          search: (prev) => ({ ...prev, businessName, tab }),
          replace: true,
        });
      }}
    />
  );
}
