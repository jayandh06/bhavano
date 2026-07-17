import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { fetchMyListing } from "@/lib/bff";
import { EditListingForm } from "@/components/home/EditListingForm";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px" }}>
        <Link href="/my-listings" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to your listings
        </Link>
        <h1 style={{ fontFamily: "var(--font-lora)", fontSize: 26, fontWeight: 600, margin: "0 0 20px" }}>
          Edit listing
        </h1>

        {!session?.accessToken ? (
          <RequireLoginPrompt message="Log in to edit this listing." />
        ) : (
          <EditListingFields accessToken={session.accessToken} id={id} />
        )}
      </div>
    </div>
  );
}

async function EditListingFields({ accessToken, id }: { accessToken: string; id: string }) {
  try {
    const listing = await fetchMyListing(accessToken, id);
    return <EditListingForm listing={listing} />;
  } catch {
    notFound();
  }
}
