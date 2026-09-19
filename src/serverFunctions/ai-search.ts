import { createServerFn } from "@tanstack/react-start";
import { getBrandLookup } from "@/server/features/ai-search/services/brandLookup";
import { computeAiVisibilityScorecard } from "@/shared/ai-visibility-score";
import { explorePrompt as runExplorePrompt } from "@/server/features/ai-search/services/promptExplorer";
import { customerHasPaidPlan } from "@/server/billing/subscription";
import { AppError } from "@/server/lib/errors";
import { isHostedServerAuthMode } from "@/server/lib/runtime-env";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  brandLookupInputSchema,
  promptExplorerInputSchema,
} from "@/types/schemas/ai-search";

/**
 * AI Visibility endpoints are gated behind the paid plan in hosted mode
 * because each call fans out to several paid DataForSEO requests. Self-hosted
 * deployments pay DataForSEO directly and aren't gated.
 */
async function assertPaidPlan(organizationId: string) {
  if (!(await isHostedServerAuthMode())) return;
  if (await customerHasPaidPlan(organizationId)) return;
  throw new AppError(
    "PAYMENT_REQUIRED",
    "Upgrade to the paid plan to use AI Visibility",
  );
}

export const lookupBrand = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(brandLookupInputSchema)
  .handler(async ({ data, context }) => {
    await assertPaidPlan(context.organizationId);
    return getBrandLookup({ ...data, projectId: context.projectId }, context);
  });

export const explorePrompt = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(promptExplorerInputSchema)
  .handler(async ({ data, context }) => {
    await assertPaidPlan(context.organizationId);
    return runExplorePrompt({ ...data, projectId: context.projectId }, context);
  });

/**
 * AI-visibility health view: the same brand lookup as lookupBrand, with a
 * derived 0-100 health scorecard attached so the dashboard can lead with a
 * single grade instead of the raw explorer tables.
 */
export const getAiVisibility = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(brandLookupInputSchema)
  .handler(async ({ data, context }) => {
    await assertPaidPlan(context.organizationId);
    const result = await getBrandLookup(
      { ...data, projectId: context.projectId },
      context,
    );
    return { result, scorecard: computeAiVisibilityScorecard(result) };
  });
