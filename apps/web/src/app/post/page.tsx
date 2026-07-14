import Link from "next/link";
import { fetchCities } from "@/lib/bff";
import { PostAdWizard } from "@/components/home/PostAdWizard";

// TEMP(auth-gate): posting is open without login for now.
export default async function PostAdPage() {
  const cities = await fetchCities();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 32px 80px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to listings
        </Link>
        <h1 style={{ fontFamily: "var(--font-lora)", fontSize: 24, fontWeight: 600, margin: "0 0 20px" }}>
          Post a free ad
        </h1>
        <PostAdWizard cities={cities} />
      </div>
    </div>
  );
}
