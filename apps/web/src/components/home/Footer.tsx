import Link from "next/link";
import type { PopularSearchDto } from "@bhavano/types";
import { fetchPopularSearches } from "@/lib/bff";
import { buildBrowsePath } from "@/lib/listingPath";
import { CATEGORY_LABELS, TRANSACTION_LABELS, transactionGroupFor } from "@/lib/seoRoute";

type PopularSearchLink = Pick<PopularSearchDto, "cityName" | "category" | "transactionType">;

// Only used if the popular-searches query comes back empty (e.g. a freshly-seeded dev DB with
// no view counts yet) — real data always wins over this once there's inventory to rank.
const FALLBACK_SEARCHES: PopularSearchLink[] = [
  { cityName: "Bengaluru", category: "house", transactionType: "rent" },
  { cityName: "Pune", category: "apartment", transactionType: "sell" },
  { cityName: "Bengaluru", category: "coworking", transactionType: "rent" },
  { cityName: "Hyderabad", category: "pg", transactionType: "rent" },
];

export async function Footer() {
  const popularSearches = await fetchPopularSearches().catch(() => []);
  const searches: PopularSearchLink[] = popularSearches.length > 0 ? popularSearches : FALLBACK_SEARCHES;

  return (
    <section className="bg-surface-alt border-t border-border py-12 px-8">
      <div className="max-w-[1280px] mx-auto grid gap-8 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <div>
          <div className="font-lora font-bold text-lg text-green mb-1.5">Bhavano</div>
          <p className="text-[13px] text-text-soft leading-[1.6] m-0">
            Verified listings to buy, rent or lease houses, apartments, coworking desks, PG accommodation and
            furniture across India — no login needed to browse.
          </p>
        </div>
        <div>
          <div className="font-bold text-[13px] text-text mb-2.5">Popular searches</div>
          <div className="flex flex-col gap-2 text-[13px]">
            {searches.map((s) => (
              <Link
                key={`${s.cityName}-${s.category}-${s.transactionType}`}
                href={buildBrowsePath({ cityName: s.cityName, transactionGroup: transactionGroupFor(s.transactionType), category: s.category })}
              >
                {CATEGORY_LABELS[s.category]} {TRANSACTION_LABELS[s.transactionType]} in {s.cityName}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <div className="font-bold text-[13px] text-text mb-2.5">Categories</div>
          <div className="flex flex-col gap-2 text-[13px]">
            <Link href={buildBrowsePath({ cityName: "Bengaluru", transactionGroup: "buy", category: "apartment" })}>Buy property</Link>
            <Link href={buildBrowsePath({ cityName: "Mumbai", transactionGroup: "rent-lease", category: "apartment" })}>Rent / Lease</Link>
            <Link href={buildBrowsePath({ cityName: "Bengaluru", transactionGroup: "buy", category: "furniture" })}>
              Furniture &amp; appliances
            </Link>
          </div>
        </div>
        <div>
          <div className="font-bold text-[13px] text-text mb-2.5">Company</div>
          <div className="flex flex-col gap-2 text-[13px]">
            <Link href="/post">Post a free ad</Link>
            <Link href="/help">Help centre</Link>
          </div>
        </div>
        <div>
          <div className="font-bold text-[13px] text-text mb-2.5">Legal</div>
          <div className="flex flex-col gap-2 text-[13px]">
            <Link href="/terms">Terms of Service</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/contact">Contact Us</Link>
          </div>
        </div>
      </div>
      <div className="max-w-[1280px] mx-auto mt-8 pt-5 border-t border-border text-xs text-muted">
        © 2026 Bhavano. All rights reserved.
      </div>
    </section>
  );
}
