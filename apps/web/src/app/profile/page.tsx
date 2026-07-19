import Link from "next/link";
import { auth } from "@/auth";
import { fetchProfile } from "@/lib/bff";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { ProfileForm } from "@/components/home/ProfileForm";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";

export default async function ProfilePage() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-bg text-text">
      <PageHeader />
      <div className="max-w-[1280px] mx-auto p-8">
        <Link href="/" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to listings
        </Link>
        <h1 className="font-lora text-[26px] font-semibold m-0 mb-1">Your profile</h1>

        {session?.accessToken && (
          <Link href="/my-listings" className="text-[13px] text-green font-bold mb-5 inline-block">
            View and edit your listings →
          </Link>
        )}

        {!session?.accessToken ? (
          <RequireLoginPrompt message="Log in to view and edit your profile." />
        ) : (
          <ProfileFields accessToken={session.accessToken} />
        )}
      </div>
      <Footer />
    </div>
  );
}

async function ProfileFields({ accessToken }: { accessToken: string }) {
  const profile = await fetchProfile(accessToken);
  return <ProfileForm profile={profile} />;
}
