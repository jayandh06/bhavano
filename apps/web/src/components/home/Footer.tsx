import Link from "next/link";
import { buildBrowsePath } from "@/lib/listingPath";

export function Footer() {
  return (
    <section style={{ background: "var(--surface-alt)", borderTop: "1px solid var(--border)", padding: "48px 32px" }}>
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))",
          gap: 32,
        }}
      >
        <div>
          <div style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 18, color: "var(--green)", marginBottom: 6 }}>
            Bhavano
          </div>
          <p style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 1.6, margin: 0 }}>
            Verified listings to buy, rent or lease houses, apartments, coworking desks, PG accommodation and
            furniture across India — no login needed to browse.
          </p>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 10 }}>Popular searches</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            <Link href={buildBrowsePath("rent", "house", "Bengaluru")}>Houses for rent in Bengaluru</Link>
            <Link href={buildBrowsePath("sell", "apartment", "Pune")}>2 BHK for sale in Pune</Link>
            <Link href={buildBrowsePath("rent", "coworking", "Bengaluru")}>Coworking spaces in Bengaluru</Link>
            <Link href={buildBrowsePath("rent", "pg", "Hyderabad")}>PG for women in Hyderabad</Link>
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 10 }}>Categories</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            <Link href={buildBrowsePath("sell", "apartment", "Bengaluru")}>Buy property</Link>
            <Link href={buildBrowsePath("rent", "apartment", "Mumbai")}>Rent / Lease</Link>
            <Link href={buildBrowsePath("sell", "furniture", "Bengaluru")}>Furniture &amp; appliances</Link>
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 10 }}>Company</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            <a href="#">About</a>
            <a href="#">Post a free ad</a>
            <a href="#">Help centre</a>
          </div>
        </div>
      </div>
      <div
        style={{
          maxWidth: 1280,
          margin: "32px auto 0",
          paddingTop: 20,
          borderTop: "1px solid var(--border)",
          fontSize: 12,
          color: "var(--muted)",
        }}
      >
        © 2026 Bhavano. All rights reserved.
      </div>
    </section>
  );
}
