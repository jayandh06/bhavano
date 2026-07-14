import Link from "next/link";
import type { ListingCardDto } from "@bhavano/types";
import { ListingCard } from "./ListingCard";

export function ListingGrid({
  items,
  cityName,
  loadMoreHref,
}: {
  items: ListingCardDto[];
  cityName: string;
  loadMoreHref: string | null;
}) {
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 24,
        }}
      >
        {items.map((item) => (
          <ListingCard key={item.id} item={item} cityName={cityName} />
        ))}
      </div>

      {loadMoreHref && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 36 }}>
          <Link
            href={loadMoreHref}
            style={{
              background: "var(--surface)",
              border: "1.5px solid var(--green)",
              color: "var(--green)",
              borderRadius: 10,
              padding: "13px 32px",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Load more listings
          </Link>
        </div>
      )}
    </>
  );
}
