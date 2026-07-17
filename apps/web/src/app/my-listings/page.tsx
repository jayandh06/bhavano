import Link from "next/link";
import type { ListingDetailDto, ListingStatus } from "@bhavano/types";
import { auth } from "@/auth";
import { fetchMyListings } from "@/lib/bff";
import { buildListingPath } from "@/lib/listingPath";
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
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to listings
        </Link>
        <h1 style={{ fontFamily: "var(--font-lora)", fontSize: 26, fontWeight: 600, margin: "0 0 20px" }}>
          Your listings
        </h1>

        {!session?.accessToken ? (
          <RequireLoginPrompt message="Log in to view and edit the ads you've posted." />
        ) : (
          <MyListingsGrid accessToken={session.accessToken} />
        )}
      </div>
    </div>
  );
}

async function MyListingsGrid({ accessToken }: { accessToken: string }) {
  const listings = await fetchMyListings(accessToken);

  if (listings.length === 0) {
    return (
      <p style={{ color: "var(--muted)", fontSize: 14 }}>
        You haven&apos;t posted anything yet —{" "}
        <Link href="/post" style={{ color: "var(--green)", fontWeight: 700 }}>
          post your first ad
        </Link>
        .
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {listings.map((item) => (
        <MyListingRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function MyListingRow({ item }: { item: ListingDetailDto }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 16,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{item.title}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: STATUS_COLORS[item.status],
              border: `1px solid ${STATUS_COLORS[item.status]}`,
              borderRadius: 6,
              padding: "2px 8px",
            }}
          >
            {item.isExpired && item.status === "active" ? "Expired" : STATUS_LABELS[item.status]}
          </span>
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
          {item.price} {item.priceQualifier} · {item.area}, {item.cityName}
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
          <span>👁 {item.viewCount}</span>
          <span>♥ {item.likeCount}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
        <Link
          href={buildListingPath(item)}
          style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}
        >
          View
        </Link>
        <Link
          href={`/my-listings/${item.id}/edit`}
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--on-green)",
            background: "var(--green)",
            borderRadius: 8,
            padding: "8px 14px",
            whiteSpace: "nowrap",
          }}
        >
          Edit
        </Link>
      </div>
    </div>
  );
}
