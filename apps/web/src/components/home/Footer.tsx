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
            <Link href={buildBrowsePath({ cityName: "Bengaluru", transactionGroup: "rent-lease", category: "house" })}>
              Houses for rent in Bengaluru
            </Link>
            <Link href={buildBrowsePath({ cityName: "Pune", transactionGroup: "buy", category: "apartment", facetValue: 2 })}>
              2 BHK for sale in Pune
            </Link>
            <Link href={buildBrowsePath({ cityName: "Bengaluru", transactionGroup: "rent-lease", category: "coworking" })}>
              Coworking spaces in Bengaluru
            </Link>
            <Link href={buildBrowsePath({ cityName: "Hyderabad", transactionGroup: "rent-lease", category: "pg" })}>
              PG for women in Hyderabad
            </Link>
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 10 }}>Categories</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            <Link href={buildBrowsePath({ cityName: "Bengaluru", transactionGroup: "buy", category: "apartment" })}>Buy property</Link>
            <Link href={buildBrowsePath({ cityName: "Mumbai", transactionGroup: "rent-lease", category: "apartment" })}>Rent / Lease</Link>
            <Link href={buildBrowsePath({ cityName: "Bengaluru", transactionGroup: "buy", category: "furniture" })}>
              Furniture &amp; appliances
            </Link>
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 10 }}>Company</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            <a href="#">About</a>
            <a href="#">Post a free ad</a>
            <Link href="/help">Help centre</Link>
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 10 }}>Legal</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/contact">Contact Us</Link>
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
