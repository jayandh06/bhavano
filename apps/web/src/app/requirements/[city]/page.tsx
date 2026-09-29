import type { Metadata } from "next";
import { resolveCity } from "@/lib/browseRoute";
import { RequirementsFeedPage } from "@/components/home/RequirementsFeedPage";

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const city = await resolveCity((await params).city).catch(() => null);
  const where = city ? ` in ${city.name}` : "";
  return {
    title: `Requirements${where}: what buyers and tenants are looking for`,
    description: `Open property requirements${where} on Bhavano, for owners and agents with something that fits.`,
    robots: { index: false, follow: false },
  };
}

export default async function CityRequirementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ city }, sp] = await Promise.all([params, searchParams]);
  return <RequirementsFeedPage citySlug={city} searchParams={sp} />;
}
