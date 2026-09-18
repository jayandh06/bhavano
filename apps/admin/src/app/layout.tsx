import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminNav } from "@/components/AdminNav";
import { RememberFilters } from "@/components/RememberFilters";
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
        <AdminNav />
        {/* Suspense because it reads searchParams, which opts its subtree into client-side
          * rendering — without the boundary that would apply to every page in this layout. It
          * renders nothing, so there is no fallback to show. */}
        <Suspense fallback={null}>
          <RememberFilters />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
