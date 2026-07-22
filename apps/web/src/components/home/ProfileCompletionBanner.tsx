"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserProfileDto } from "@bhavano/types";
import { fetchProfileAction } from "@/app/actions/users";

/** Nags a logged-in user to add a missing email/phone on every page — not dismissible, since the
 * ask is to keep asking until the detail is actually filled in. Refetches on every client-side
 * navigation so saving it on /profile and navigating away clears the banner without a reload. */
export function ProfileCompletionBanner() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<UserProfileDto | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProfileAction().then((result) => {
      if (!cancelled) setProfile(result.requiresLogin ? null : result.profile);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (!profile) return null;

  const missing = [!profile.email && "email", !profile.phone && "phone number"].filter(Boolean) as string[];
  if (missing.length === 0) return null;

  return (
    <div className="bg-surface-alt border-b border-border text-center text-[13px] text-text-soft px-4 py-2.5">
      Add your {missing.join(" and ")} to your profile so we can keep you updated.{" "}
      <Link href="/profile" className="text-green font-bold">
        Update profile →
      </Link>
    </div>
  );
}
