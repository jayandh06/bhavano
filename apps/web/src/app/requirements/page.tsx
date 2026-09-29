import type { Metadata } from "next";
import { RequirementsFeedPage } from "@/components/home/RequirementsFeedPage";

export const metadata: Metadata = {
  title: "Requirements: what buyers and tenants are looking for",
  description: "Open property requirements on Bhavano, for owners and agents with something that fits.",
  // Individual requirements are never indexed; city aggregates may be later, above a volume floor.
  // See docs/plans/requirements-feed-for-owners-agents.md.
  robots: { index: false, follow: false },
};

export default async function RequirementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <RequirementsFeedPage searchParams={await searchParams} />;
}
