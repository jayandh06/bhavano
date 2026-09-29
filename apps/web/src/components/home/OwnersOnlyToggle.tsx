"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buttonClass } from "./BrowseFilterBar";

/** "Owners only" pill for the Buy / Rent & Lease filter rows — toggles `?postedBy=owner` on the
 * current page (a query-param filter, so the canonical stays the plain path). Resets `page`,
 * since the filtered result set has its own page count. */
export function OwnersOnlyToggle({ active }: { active: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function toggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (active) params.delete("postedBy");
    else params.set("postedBy", "owner");
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <button className={buttonClass(active)} onClick={toggle} aria-pressed={active}>
      {active ? "✓ " : ""}Owners only
    </button>
  );
}
