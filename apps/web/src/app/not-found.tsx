import Link from "next/link";
import { StaticPageLayout } from "@/components/home/StaticPageLayout";
import { buildBrowsePath } from "@/lib/listingPath";

export const metadata = {
  title: "Page not found",
  description: "The page you're looking for doesn't exist or may have moved.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <StaticPageLayout title="Page not found">
      <p>
        The page you&apos;re looking for doesn&apos;t exist, or may have moved. Try one of these
        instead:
      </p>
      <ul style={{ display: "flex", flexDirection: "column", gap: 10, paddingLeft: 20 }}>
        <li>
          <Link href="/">Browse homes, rentals, PG, coworking, furniture &amp; interiors</Link>
        </li>
        <li>
          <Link href={buildBrowsePath({ cityName: "Bengaluru", transactionGroup: "buy", category: "apartment" })}>
            Apartments for sale in Bengaluru
          </Link>
        </li>
        <li>
          <Link href={buildBrowsePath({ cityName: "Mumbai", transactionGroup: "rent-lease", category: "house" })}>
            Houses for rent in Mumbai
          </Link>
        </li>
        <li>
          <Link href="/help">Help Centre</Link>
        </li>
      </ul>
    </StaticPageLayout>
  );
}
