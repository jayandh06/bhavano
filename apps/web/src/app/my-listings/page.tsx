import Link from "next/link";
import type { ListingDetailDto, ListingStatus } from "@bhavano/types";
import { auth } from "@/auth";
import { fetchMyListings } from "@/lib/bff";
import { buildListingPath } from "@/lib/listingPath";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";

const STATUS_LABELS: Record<ListingStatus, string> = {
  active: "Active",
  sold: "Sold",
  rented: "Rented",
  deactivated: "Deactivated",
};

const STATUS_COLORS: Record<ListingStatus, string> = {
  active: "var(--green)",
  sold: "var(--muted)",
  rented: "var(--muted)",
  deactivated: "#b3413a",
};

export default async function MyListingsPage() {
  const session = await auth();

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <PageHeader />
      <div className="flex-1 w-full max-w-[960px] mx-auto p-8">
        <Link href="/" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to listings
        </Link>
        <h1 className="font-lora text-[26px] font-semibold m-0 mb-5">Your listings</h1>

        {!session?.accessToken ? (
          <RequireLoginPrompt message="Log in to view and edit the ads you've posted." />
        ) : (
          <MyListingsGrid accessToken={session.accessToken} />
        )}
      </div>
      <Footer />
    </div>
  );
}

async function MyListingsGrid({ accessToken }: { accessToken: string }) {
  const listings = await fetchMyListings(accessToken);

  if (listings.length === 0) {
    return (
      <p className="text-muted text-sm">
        You haven&apos;t posted anything yet —{" "}
        <Link href="/post" className="text-green font-bold">
          post your first ad
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {listings.map((item) => (
        <MyListingRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function MyListingRow({ item }: { item: ListingDetailDto }) {
  return (
    <div className="flex justify-between items-center gap-4 border border-border rounded-[10px] p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-bold text-[15px]">{item.title}</span>
          <span
            className="text-[11px] font-bold rounded-md px-2 py-0.5 border"
            style={{ color: STATUS_COLORS[item.status], borderColor: STATUS_COLORS[item.status] }}
          >
            {item.isExpired && item.status === "active" ? "Expired" : STATUS_LABELS[item.status]}
          </span>
        </div>
        <div className="text-[13px] text-muted mt-1">
          {item.price} {item.priceQualifier} · {item.area}, {item.cityName}
        </div>
        <div className="flex gap-3 text-[11.5px] text-muted mt-1.5">
          <span>👁 {item.viewCount}</span>
          <span>♥ {item.likeCount}</span>
        </div>
      </div>
      <div className="flex gap-2.5 shrink-0">
        <Link href={buildListingPath(item)} className="text-[13px] font-bold text-text whitespace-nowrap">
          View
        </Link>
        <Link
          href={`/my-listings/${item.id}/edit`}
          className="text-[13px] font-bold text-on-green bg-green rounded-lg px-3.5 py-2 whitespace-nowrap"
        >
          Edit
        </Link>
      </div>
    </div>
  );
}
