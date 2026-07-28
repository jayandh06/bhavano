"use client";

import { useState } from "react";
import Link from "next/link";
import type { UserProfileDto } from "@bhavano/types";
import { PlanComparisonTable } from "@/components/home/PlanComparisonTable";
import { ListingSlotMeter } from "@/components/home/ListingSlotMeter";
import { SubscribeButton } from "@/components/home/SubscribeButton";
import { PRO_LISTING_SLOTS_PER_UNIT } from "@bhavano/types/listingSlots";

type Tab = "compare" | "subscribe";

export function PremiumPlansView({ profile }: { profile: UserProfileDto }) {
  const [tab, setTab] = useState<Tab>("compare");

  const premiumUntil = profile.premiumUntil ? new Date(profile.premiumUntil) : null;
  const agentProUntil = profile.agentProUntil ? new Date(profile.agentProUntil) : null;
  const sellerSlotPackUntil = profile.sellerSlotPackUntil ? new Date(profile.sellerSlotPackUntil) : null;
  const isPremium = !!premiumUntil && premiumUntil.getTime() > Date.now();
  const isAgentPro = !!agentProUntil && agentProUntil.getTime() > Date.now();
  const isSellerPack = !!sellerSlotPackUntil && sellerSlotPackUntil.getTime() > Date.now();
  const proSlots = (profile.agentProUnits || 1) * PRO_LISTING_SLOTS_PER_UNIT;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 p-1 bg-surface-alt border border-border rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setTab("compare")}
          className={`px-4 py-2 text-[13px] font-bold rounded-lg cursor-pointer border-0 ${
            tab === "compare" ? "bg-surface text-text shadow-sm" : "bg-transparent text-muted"
          }`}
        >
          Compare plans
        </button>
        <button
          type="button"
          onClick={() => setTab("subscribe")}
          className={`px-4 py-2 text-[13px] font-bold rounded-lg cursor-pointer border-0 ${
            tab === "subscribe" ? "bg-surface text-text shadow-sm" : "bg-transparent text-muted"
          }`}
        >
          Subscribe &amp; manage
        </button>
      </div>

      {tab === "compare" ? (
        <PlanComparisonTable profile={profile} />
      ) : (
        <div className="flex flex-col gap-6">
          <ListingSlotMeter profile={profile} />

          <section className="border border-border rounded-2xl p-6 bg-surface">
            <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
              <div className="font-lora text-xl font-bold text-text">Free seller</div>
              <span className="text-[13px] font-bold text-green">₹0</span>
            </div>
            <p className="text-[13px] text-muted mb-3 m-0">5 active listings — included for every account.</p>
            <Link
              href="/post"
              className="inline-block text-[13px] font-bold text-green border-[1.5px] border-border rounded-[10px] px-4 py-2.5 bg-surface-alt"
            >
              Post a free ad →
            </Link>
          </section>

          <section className="border border-border rounded-2xl p-6 bg-surface">
            <div className="font-lora text-xl font-bold text-text mb-1">⭐ Bhavano Plus</div>
            <p className="text-[13px] text-muted mb-4 m-0">For buyers &amp; renters — get noticed, get answered faster.</p>
            <ul className="text-[13px] text-text-soft m-0 mb-4 pl-5 list-disc flex flex-col gap-1">
              <li>
                <strong>Early-access alerts</strong> — saved-search notifications when a matching listing posts
              </li>
              <li>A &ldquo;✓ Verified Buyer&rdquo; badge on messages you send</li>
              <li>Priority visibility in sellers&apos; inboxes</li>
            </ul>
            {isPremium && premiumUntil ? (
              <div className="flex flex-col gap-2 items-start">
                <p className="text-[13px] font-bold text-green m-0">Active until {premiumUntil.toLocaleDateString()}</p>
                <Link href="/saved-searches" className="text-[13px] font-bold text-green">
                  Manage your saved searches →
                </Link>
              </div>
            ) : (
              <SubscribeButton tier="buyerPremium" />
            )}
          </section>

          <section id="seller-slots" className="border border-border rounded-2xl p-6 bg-surface">
            <div className="font-lora text-xl font-bold text-text mb-1">📦 Seller slot pack</div>
            <p className="text-[13px] text-muted mb-4 m-0">For individual sellers — more active ads at once.</p>
            <ul className="text-[13px] text-text-soft m-0 mb-4 pl-5 list-disc flex flex-col gap-1">
              <li>
                <strong>10 active listings</strong> at once (5 free + 5 extra)
              </li>
              <li>Slots free up when an ad expires or you remove it</li>
            </ul>
            {isSellerPack && sellerSlotPackUntil ? (
              <p className="text-[13px] font-bold text-green m-0">Active until {sellerSlotPackUntil.toLocaleDateString()}</p>
            ) : (
              <SubscribeButton tier="sellerSlotPack" />
            )}
          </section>

          <section id="agent-pro" className="border border-border rounded-2xl p-6 bg-surface">
            <div className="font-lora text-xl font-bold text-text mb-1">🏢 Agent/Broker Pro</div>
            <p className="text-[13px] text-muted mb-4 m-0">For agents &amp; brokers — scale inventory and brand.</p>
            <ul className="text-[13px] text-text-soft m-0 mb-4 pl-5 list-disc flex flex-col gap-1">
              <li>
                <strong>{PRO_LISTING_SLOTS_PER_UNIT} active listings</strong> per ₹499/month (each extra ₹499 adds +20)
              </li>
              <li>Public storefront with Bhavano Pro badge</li>
              <li>Elevated video limits when posting</li>
              <li>One 7-day boost credit per month</li>
            </ul>
            {isAgentPro && agentProUntil ? (
              <div className="flex flex-col gap-2 items-start">
                <p className="text-[13px] font-bold text-green m-0">
                  Active until {agentProUntil.toLocaleDateString()} · {proSlots} listing slots
                </p>
                <Link href={`/agent/${profile.id}`} className="text-[13px] font-bold text-green">
                  View your storefront →
                </Link>
              </div>
            ) : (
              <SubscribeButton tier="agentPro" />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
