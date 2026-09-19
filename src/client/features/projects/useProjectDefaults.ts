import { useQuery } from "@tanstack/react-query";
import { getProjects } from "@/serverFunctions/projects";
import { getProjectContext } from "@/serverFunctions/projectContext";

// Phase 2: every project is one client domain. These hooks give any tab the
// project's own domain (to default its target) and the shared competitor set
// (to default its comparison list), so each tab shows the client-vs-competitor
// view by default instead of an empty form.

/** The project's own domain (bare host) or null; undefined while loading. */
export function useProjectDomain(projectId: string): string | null | undefined {
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(),
  });
  if (projectsQuery.data == null) return undefined;
  return projectsQuery.data.find((p) => p.id === projectId)?.domain ?? null;
}

/** The project's own name, for tabs keyed on a business name (Local SEO). */
export function useProjectName(projectId: string): string | undefined {
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(),
  });
  return projectsQuery.data?.find((p) => p.id === projectId)?.name;
}

/** Saved competitor domains for the project (bare hosts). */
export function useProjectCompetitors(projectId: string): string[] {
  const contextQuery = useQuery({
    queryKey: ["project-context", projectId],
    queryFn: () => getProjectContext({ data: { projectId } }),
    staleTime: 5 * 60_000,
  });
  return (contextQuery.data?.competitors ?? []).map((c) => c.domain);
}
