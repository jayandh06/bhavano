import Link from "next/link";
import { auth } from "@/auth";
import { fetchProfile } from "@/lib/bff";
import { ProfileForm } from "@/components/home/ProfileForm";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";

export default async function ProfilePage() {
  const session = await auth();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px" }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to listings
        </Link>
        <h1 style={{ fontFamily: "var(--font-lora)", fontSize: 26, fontWeight: 600, margin: "0 0 4px" }}>
          Your profile
        </h1>

        {session?.accessToken && (
          <Link
            href="/my-listings"
            style={{ fontSize: 13, color: "var(--green)", fontWeight: 700, marginBottom: 20, display: "inline-block" }}
          >
            View and edit your listings →
          </Link>
        )}

        {!session?.accessToken ? (
          <RequireLoginPrompt message="Log in to view and edit your profile." />
        ) : (
          <ProfileFields accessToken={session.accessToken} />
        )}
      </div>
    </div>
  );
}

async function ProfileFields({ accessToken }: { accessToken: string }) {
  const profile = await fetchProfile(accessToken);
  return <ProfileForm profile={profile} />;
}
