import type { Metadata } from "next";
import Link from "next/link";
import type { MyReferralsDto, ReferralStatus } from "@bhavano/types";
import { auth } from "@/auth";
import { BffAuthError, fetchMyReferrals } from "@/lib/bff";
import { resolvePageCityContext } from "@/lib/pageCityContext";
import { isAccessTokenValid } from "@/lib/session";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";
import { ReferralInviteActions } from "@/components/home/ReferralInviteActions";
import { Icon } from "@/components/home/Icon";

// A signed-in dashboard: nothing here for a crawler. Set per page rather than in robots.txt.
export const metadata: Metadata = {
  title: "Referrals & free boosts",
  robots: { index: false, follow: false },
};

// Never the skip reason — a referrer seeing "same device" would just learn how to dodge the check.
const STATUS_LABELS: Record<ReferralStatus, { label: string; className: string }> = {
  signed_up: { label: "Joined — waiting for their first ad", className: "text-muted" },
  ad_approved: { label: "Posted an ad", className: "text-text-soft" },
  rewarded: { label: "You earned a free boost", className: "text-green" },
  blocked: { label: "Under review", className: "text-muted" },
  reversed: { label: "Not counted", className: "text-muted" },
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const citySlug = typeof sp.city === "string" ? sp.city : undefined;
  const [session, { city, cityAreas, allCities }] = await Promise.all([auth(), resolvePageCityContext(citySlug)]);
  const accessToken = session?.accessToken;
  const loggedIn = isAccessTokenValid(accessToken);

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <PageHeader cityName={city?.name} />
      <div className="flex-1 w-full max-w-[880px] mx-auto p-8">
        <Link href="/profile" className="text-[13px] text-muted mb-4 inline-block">
          ← Back to profile
        </Link>
        <h1 className="font-lora text-[26px] font-semibold m-0 mb-1">Referrals &amp; free boosts</h1>
        <p className="text-[13px] text-muted mb-6">
          Invite people to Bhavano. When someone joins from your link and their first ad goes live, you get a free
          boost for any of your ads.
        </p>

        {!loggedIn || !accessToken ? (
          <RequireLoginPrompt message="Log in to see your referrals." />
        ) : (
          <ReferralsDashboard accessToken={accessToken} />
        )}
      </div>
      <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}

async function ReferralsDashboard({ accessToken }: { accessToken: string }) {
  let data: MyReferralsDto;
  try {
    data = await fetchMyReferrals(accessToken);
  } catch (error) {
    if (error instanceof BffAuthError) {
      return <RequireLoginPrompt message="Log in to see your referrals." />;
    }
    throw error;
  }

  const credits = data.availableCredits;
  const soonest = credits[0];

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-[color:var(--gold)]/40 bg-surface-alt/60 p-5 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Icon name="boost" className="text-[color:var(--gold)] text-lg" />
          <span className="font-lora font-bold text-[17px]">
            {credits.length === 0
              ? "No free boosts yet"
              : credits.length === 1
                ? "You have 1 free boost"
                : `You have ${credits.length} free boosts`}
          </span>
        </div>
        {soonest ? (
          <p className="text-[13px] text-text-soft m-0">
            Next one expires on {dateFormatter.format(new Date(soonest.expiresAt))}. Use it from{" "}
            <Link href="/my-listings" className="font-bold text-green">
              My listings
            </Link>{" "}
            — tap Boost on any ad.
          </p>
        ) : (
          <p className="text-[13px] text-text-soft m-0">
            Each friend who joins from your link and gets their first ad approved earns you a free{" "}
            {data.boostDays}-day boost.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 flex flex-col gap-3">
        <h2 className="text-[15px] font-bold m-0">Your invite link</h2>
        <ReferralInviteActions referralCode={data.referralCode} />
        <p className="text-[12.5px] text-muted m-0">
          Sharing one of your ads works too — the share button on{" "}
          <Link href="/my-listings" className="font-bold text-green">
            My listings
          </Link>{" "}
          carries your link.
        </p>
      </section>

      <section className="grid grid-cols-3 gap-3">
        {(
          [
            ["Joined", data.counts.signedUp],
            ["Posted an ad", data.counts.firstAdApproved],
            ["Boosts earned", data.counts.rewarded],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-surface p-4 text-center">
            <div className="font-lora text-[24px] font-bold">{value}</div>
            <div className="text-[12px] text-muted">{label}</div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-bold m-0">People you referred</h2>
        {data.recent.length === 0 ? (
          <p className="text-[13px] text-muted m-0">Nobody yet. Share your link to get started.</p>
        ) : (
          <ul className="m-0 p-0 list-none rounded-2xl border border-border bg-surface overflow-hidden">
            {data.recent.map((item) => {
              const status = STATUS_LABELS[item.status] ?? STATUS_LABELS.signed_up;
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border last:border-0"
                >
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-bold">{item.firstName ?? "A friend"}</div>
                    <div className="text-[12px] text-muted">Joined {dateFormatter.format(new Date(item.signedUpAt))}</div>
                  </div>
                  <span className={`text-[12.5px] font-bold ${status.className}`}>{status.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-1.5 text-[12.5px] text-muted">
        <h2 className="text-[13px] font-bold text-text m-0">How it works</h2>
        <p className="m-0">
          You earn one free {data.boostDays}-day boost for each person who signs up from your link and has their first
          ad approved. Free boosts expire {data.creditExpiryDays} days after you earn them, and you can
          earn up to {data.monthlyCap} a month ({data.creditsThisMonth} so far this month).
        </p>
        <p className="m-0">
          Boosts have no cash value and can&apos;t be transferred. Referrals from the same phone or device as yours
          don&apos;t count.
        </p>
      </section>
    </div>
  );
}
