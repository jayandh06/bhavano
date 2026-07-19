import Link from "next/link";
import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { PageHeader } from "./PageHeader";

export async function StaticPageLayout({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <PageHeader />
      <div className="flex-1 w-full max-w-[720px] mx-auto p-8">
        <Link href="/" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to listings
        </Link>
        <h1 className="font-lora text-[26px] font-semibold m-0 mb-1">{title}</h1>
        {updated && <p className="text-[12.5px] text-muted m-0 mb-7">Last updated: {updated}</p>}
        <div className="flex flex-col gap-[22px] text-sm leading-[1.7] text-text-soft">{children}</div>
      </div>
      <Footer />
    </div>
  );
}

export function PageSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[15px] font-bold text-text m-0 mb-2">{heading}</h2>
      {children}
    </section>
  );
}
