import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { BffAuthError, fetchMyListing } from "@/lib/bff";
import { EditListingForm } from "@/components/home/EditListingForm";
import { PageHeader } from "@/components/home/PageHeader";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  return (
    <div className="min-h-screen bg-bg text-text">
      <PageHeader />
      <div className="max-w-[640px] mx-auto p-8">
        <Link href="/my-listings" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to your listings
        </Link>
        <h1 className="font-lora text-[26px] font-semibold m-0 mb-5">Edit listing</h1>

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
  let listing;
  try {
    listing = await fetchMyListing(accessToken, id);
  } catch (error) {
    if (error instanceof BffAuthError) {
      return <RequireLoginPrompt message="Log in to edit this listing." />;
    }
    notFound();
  }
  return <EditListingForm listing={listing} />;
}
