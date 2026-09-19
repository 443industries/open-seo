import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";

/**
 * The organization that owns a project — needed to build a system
 * BillingCustomerContext for scheduled (userless) tracker runs.
 */
export async function getProjectOrganizationId(
  projectId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return row?.organizationId ?? null;
}
