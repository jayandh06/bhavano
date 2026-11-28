import type { Metadata } from "next";
import { AdminNav } from "@/components/AdminNav";
import { MarketProvider } from "@/components/MarketContext";
import { adminMarket } from "@/lib/market";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bhavano Admin",
  description: "Listing moderation for Bhavano.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MarketProvider id={adminMarket().id}>
          <AdminNav />
          <main className="admin-page-content">{children}</main>
        </MarketProvider>
      </body>
    </html>
  );
}
