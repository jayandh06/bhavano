import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchListingById } from "@/lib/bff";
import { AdminEditListingForm } from "@/components/AdminEditListingForm";

/** Same route shape as the owner's own /my-listings/[id]/edit on the web app — an admin editing
 * a listing's content lands on a dedicated page, not a collapsed panel buried in the moderation
 * queue view, mirroring the flow an owner already knows. See AdminEditListingForm's own doc
 * comment for why this renders its own admin-native fields UI rather than importing the web
 * app's CategoryFieldsAccordion (different app, no Tailwind, no shared component package). */
export default async function AdminEditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { accessToken } = await requireAdmin();

  const listing = await fetchListingById(accessToken, id).catch(() => null);
  if (!listing) notFound();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <Link href={`/listings/${id}`} style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to listing
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 20px" }}>Edit listing</h1>
        <AdminEditListingForm listing={listing} />
      </div>
    </div>
  );
}
