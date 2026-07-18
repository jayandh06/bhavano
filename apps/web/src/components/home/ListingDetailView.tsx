import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ListingDetailDto } from "@bhavano/types";
import { ListingDetailActions } from "./ListingDetailActions";
import { PostSuccessTracker } from "./PostSuccessTracker";
import { ViewTracker } from "./ViewTracker";

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

/** The full listing-detail page body — shared by the SEO catch-all route so it renders
 * identically regardless of which URL depth resolved to this listing. */
export function ListingDetailView({ listing }: { listing: ListingDetailDto }) {
  const attributeEntries = Object.entries(listing.attributes);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <ViewTracker listingId={listing.id} />
      <Suspense>
        <PostSuccessTracker listingId={listing.id} />
      </Suspense>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 32px 80px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to listings
        </Link>

        <div
          style={{
            position: "relative",
            height: 320,
            borderRadius: 16,
            overflow: "hidden",
            background: listing.photosFull[0]
              ? undefined
              : `repeating-linear-gradient(135deg, ${listing.imgColors[0]}, ${listing.imgColors[0]} 14px, ${listing.imgColors[1]} 14px, ${listing.imgColors[1]} 28px)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: listing.photosFull.length > 1 ? 10 : 24,
          }}
        >
          {listing.photosFull[0] && (
            <Image
              src={listing.photosFull[0]}
              alt={listing.title}
              fill
              priority
              sizes="(max-width: 880px) 100vw, 880px"
              style={{ objectFit: "cover" }}
            />
          )}
          {listing.photosFull.length === 0 && (
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 13,
                color: "#ffffffcc",
                background: "#00000030",
                padding: "6px 12px",
                borderRadius: 6,
              }}
            >
              {listing.imgLabel}
            </span>
          )}
          <span
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              background: "var(--green)",
              color: "var(--on-green)",
              fontSize: 12,
              fontWeight: 700,
              padding: "5px 12px",
              borderRadius: 6,
            }}
          >
            {listing.tag}
          </span>
          {listing.isExpired && (
            <span
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "#242420",
                color: "#F5F1E6",
                fontSize: 12,
                fontWeight: 700,
                padding: "5px 12px",
                borderRadius: 6,
              }}
            >
              Expired
            </span>
          )}
        </div>

        {listing.photosFull.length > 1 && (
          <div style={{ display: "flex", gap: 10, marginBottom: 24, overflowX: "auto" }}>
            {listing.photosFull.map((photoUrl, i) => (
              <Image
                key={photoUrl}
                src={photoUrl}
                alt={`${listing.title} photo ${i + 1}`}
                width={80}
                height={80}
                style={{ objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
              />
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 8 }}>
          <div style={{ fontFamily: "var(--font-lora)", fontSize: 28, fontWeight: 700, color: "var(--green)" }}>
            {listing.price}
          </div>
          {listing.priceQualifier && (
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--muted)",
                background: "var(--surface-alt)",
                padding: "5px 12px",
                borderRadius: 6,
                whiteSpace: "nowrap",
              }}
            >
              {listing.priceQualifier}
            </div>
          )}
        </div>

        <h1 style={{ fontFamily: "var(--font-lora)", fontSize: 22, fontWeight: 600, margin: "0 0 8px" }}>
          {listing.title}
        </h1>
        <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 8 }}>
          📍 {listing.area}, {listing.cityName}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16, display: "flex", gap: 14 }}>
          <span>👁 {listing.viewCount} views</span>
          <span>{listing.isExpired ? "Expired" : `Expires in ${daysUntil(listing.expiresAt)} days`}</span>
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          {listing.specs.map((spec) => (
            <span
              key={spec}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-soft)",
                background: "var(--surface-alt)",
                padding: "6px 12px",
                borderRadius: 6,
              }}
            >
              {spec}
            </span>
          ))}
        </div>

        {attributeEntries.length > 0 && (
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
              background: "var(--surface)",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
              {attributeEntries.map(([key, value]) => (
                <div key={key} style={{ fontSize: 13, color: "var(--text-soft)" }}>
                  <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{key}</span>: {String(value)}
                </div>
              ))}
            </div>
          </div>
        )}

        {listing.isExpired ? (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            This ad has expired and is no longer accepting responses.
          </p>
        ) : (
          <>
            <span style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 12 }}>
              Ads shown without login — sign in only to respond
            </span>
            <ListingDetailActions
              listingId={listing.id}
              initialIsFavourited={listing.isFavourited}
              initialLikeCount={listing.likeCount}
            />
          </>
        )}
      </div>
    </div>
  );
}
