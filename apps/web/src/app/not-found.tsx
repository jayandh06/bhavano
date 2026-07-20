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
      <ul className="flex flex-col gap-2.5 pl-5">
        <li>
          <Link href="/">Browse homes, rentals, plots, PG, coworking, commercial spaces, furniture &amp; interiors</Link>
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
