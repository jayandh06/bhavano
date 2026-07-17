import Link from "next/link";
import type { ReactNode } from "react";

export function StaticPageLayout({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to listings
        </Link>
        <h1 style={{ fontFamily: "var(--font-lora)", fontSize: 26, fontWeight: 600, margin: "0 0 4px" }}>{title}</h1>
        {updated && <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 28px" }}>Last updated: {updated}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 22, fontSize: 14, lineHeight: 1.7, color: "var(--text-soft)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function PageSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: "0 0 8px" }}>{heading}</h2>
      {children}
    </section>
  );
}
