import Link from "next/link";
import { fetchCities } from "@/lib/bff";
import { PostAdWizard } from "@/components/home/PostAdWizard";

// TEMP(auth-gate): posting is open without login for now.
export default async function PostAdPage() {
  const cities = await fetchCities();

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="max-w-[560px] mx-auto px-8 pt-6 pb-20">
        <Link href="/" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to listings
        </Link>
        <h1 className="font-lora text-2xl font-semibold m-0 mb-5">Post a free ad</h1>
        <PostAdWizard cities={cities} />
      </div>
    </div>
  );
}
