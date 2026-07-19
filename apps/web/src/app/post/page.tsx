import Link from "next/link";
import { fetchCities } from "@/lib/bff";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { PostAdWizard } from "@/components/home/PostAdWizard";

// TEMP(auth-gate): posting is open without login for now.
export default async function PostAdPage() {
  const cities = await fetchCities();

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <PageHeader />
      <div className="flex-1 w-full max-w-[780px] mx-auto px-8 pt-6 pb-20">
        <Link href="/" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to listings
        </Link>
        <h1 className="font-lora text-2xl font-semibold m-0 mb-5">Post a free ad</h1>
        <PostAdWizard cities={cities} />
      </div>
      <Footer />
    </div>
  );
}
