"use client";

import { useState } from "react";
import { pushDataLayerEvent } from "@/lib/gtm";
import { taggedShareUrl, whatsappShareHref } from "@/lib/shareLinks";
import { Icon } from "./Icon";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bhavano.com";
const INVITE_TEXT = "I use Bhavano to buy, sell and rent property. Post your own ad here:";

/** Share/copy for the Referrals page's invite link — the homepage carrying the user's `ref`. */
export function ReferralInviteActions({ referralCode }: { referralCode: string }) {
  const [copied, setCopied] = useState(false);
  const whatsappUrl = taggedShareUrl(`${SITE_URL}/`, "whatsapp", "referral_invite", referralCode);
  const copyUrl = taggedShareUrl(`${SITE_URL}/`, "copy", "referral_invite", referralCode);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      pushDataLayerEvent("referral_invite_share", { channel: "copy" });
    } catch {
      // Clipboard can be blocked (insecure context, permissions) — the link stays visible to copy by hand.
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
        <span className="flex-1 min-w-0 truncate text-[13px] text-text-soft">{copyUrl}</span>
        <button
          type="button"
          onClick={onCopy}
          className="text-[13px] font-bold text-green bg-transparent border-0 cursor-pointer inline-flex items-center gap-1 shrink-0"
        >
          <Icon name={copied ? "check" : "copy"} /> {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <a
        href={whatsappShareHref(INVITE_TEXT, whatsappUrl)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => pushDataLayerEvent("referral_invite_share", { channel: "whatsapp" })}
        className="bg-green text-on-green rounded-lg px-5 py-3 text-[15px] font-bold text-center inline-flex items-center justify-center gap-2"
      >
        <Icon name="message" /> Invite on WhatsApp
      </a>
    </div>
  );
}
