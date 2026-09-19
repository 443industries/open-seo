import { useQuery } from "@tanstack/react-query";
import { getAiVisibility } from "@/serverFunctions/ai-search";

type Input = {
  projectId: string;
  query: string;
  competitors: string[];
};

/** Brand lookup + derived AI-visibility health scorecard. */
export function useAiVisibilityQuery(input: Input) {
  const query = input.query.trim();
  return useQuery({
    enabled: query !== "",
    queryKey: ["ai-visibility", input.projectId, query, input.competitors],
    queryFn: () =>
      getAiVisibility({
        data: {
          projectId: input.projectId,
          query,
          competitors: input.competitors,
          locationCode: 2840,
          languageCode: "en",
        },
      }),
    staleTime: 10 * 60_000,
  });
}
