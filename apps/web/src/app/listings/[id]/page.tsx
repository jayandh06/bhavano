import { notFound, permanentRedirect } from "next/navigation";
import { fetchListingById } from "@/lib/bff";
import { buildListingPath } from "@/lib/listingPath";

/** Legacy path, kept as a permanent redirect so previously shared/indexed links keep working. */
export default async function LegacyListingRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await fetchListingById(id).catch(() => null);
  if (!listing) notFound();
  permanentRedirect(buildListingPath(listing));
}
