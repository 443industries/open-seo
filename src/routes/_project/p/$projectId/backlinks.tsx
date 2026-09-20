import { useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BacklinksPage } from "@/client/features/backlinks/BacklinksPage";
import { useProjectDomain } from "@/client/features/projects/useProjectDefaults";
import { ScheduleBar } from "@/client/features/metrics/ScheduleBar";
import {
  DEFAULT_BACKLINKS_PAGE_SIZE,
  backlinksSearchSchema,
} from "@/types/schemas/backlinks";
import { defaultScopeForInput } from "@/shared/researchScope";

export const Route = createFileRoute("/_project/p/$projectId/backlinks")({
  validateSearch: backlinksSearchSchema,
  component: BacklinksRoute,
});

function BacklinksRoute() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const {
    target = "",
    scope: rawScope,
    tab = "backlinks",
    page = 1,
    size = DEFAULT_BACKLINKS_PAGE_SIZE,
    sort,
    order,
    view,
  } = Route.useSearch();
  const scope = rawScope ?? defaultScopeForInput(target);

  // Phase 2: default the target to the project's own domain on first open.
  const projectDomain = useProjectDomain(projectId);
  const appliedDefault = useRef(false);
  useEffect(() => {
    if (appliedDefault.current || target || projectDomain === undefined) return;
    appliedDefault.current = true;
    if (projectDomain) {
      void navigate({
        search: (prev) => ({ ...prev, target: projectDomain }),
        replace: true,
      });
    }
  }, [projectDomain, target, navigate]);

  return (
    <>
      <ScheduleBar projectId={projectId} metricType="backlinks" />
      <BacklinksPage
        projectId={projectId}
        navigate={navigate}
        searchState={{
          target,
          scope,
          // Referring domains can't be filtered to a subfolder.
          tab: scope === "subfolder" && tab === "domains" ? "backlinks" : tab,
          page,
          pageSize: size,
          sort,
          order,
          view,
        }}
      />
    </>
  );
}
