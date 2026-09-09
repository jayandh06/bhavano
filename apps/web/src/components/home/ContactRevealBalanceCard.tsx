import Link from "next/link";
import type { ContactRevealBalanceDto } from "@bhavano/types";
import { Icon } from "./Icon";

/** Profile page's glanceable summary of ContactRevealBalanceDto — the "do I need to buy credits
 * before I next try to view a contact" answer, without having to hit "View Contact" on some
 * listing first to find out. See PremiumPlansView's own contact-reveal-credits section for the
 * pricing description; this card is balance, not pricing. */
export function ContactRevealBalanceCard({ balance }: { balance: ContactRevealBalanceDto }) {
  const hasAny = balance.freeRevealsRemaining > 0 || balance.creditsRemaining > 0;

  return (
    <section className="border border-border rounded-2xl p-6 bg-surface">
      <div className="font-lora text-lg font-bold text-text mb-3 flex items-center gap-2">
        <Icon name="phone" /> Contact reveal credits
      </div>
      {hasAny ? (
        <div className="flex flex-col gap-1 text-[13px] text-text-soft mb-3">
          {balance.freeRevealsRemaining > 0 && (
            <p className="m-0">
              <strong className="text-text">{balance.freeRevealsRemaining}</strong> free reveal
              {balance.freeRevealsRemaining === 1 ? "" : "s"} left
            </p>
          )}
          {balance.creditsRemaining > 0 && (
            <p className="m-0">
              <strong className="text-text">{balance.creditsRemaining}</strong> purchased credit
              {balance.creditsRemaining === 1 ? "" : "s"}
              {balance.nextCreditExpiryAt && (
                <span className="text-muted">
                  {" "}
                  — earliest expires {new Date(balance.nextCreditExpiryAt).toLocaleDateString()}
                </span>
              )}
            </p>
          )}
        </div>
      ) : (
        <p className="text-[13px] text-muted m-0 mb-3">
          No reveals left. Buy a credit pack from any listing&apos;s &ldquo;View Contact&rdquo; button.
        </p>
      )}
      <Link href="/premium#contact-reveal-credits" className="text-[13px] font-bold text-green inline-block">
        See pricing →
      </Link>
    </section>
  );
}
