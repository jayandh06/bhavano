import Link from "next/link";
import type { FeedbackRequestMessageCardDto } from "@bhavano/types";
import { Icon } from "./Icon";

/** The "How was posting this ad?" message drawn as a card, the sibling of BoostOfferMessageCard: which ad it is about, one line of
 * what is asked, and a Share feedback button that opens `/feedback/post/<id>`. See docs/plans/post-ad-experience-feedback.md. */
export function FeedbackRequestMessageCard({ card }: { card: FeedbackRequestMessageCardDto }) {
  return (
    <div className="self-start shrink-0 w-full max-w-[400px] rounded-xl border border-border bg-surface text-text overflow-hidden">
      <div className="flex gap-3 p-3.5 pb-3 bg-surface-alt">
        {card.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.imageUrl} alt="" className="w-[76px] h-[76px] shrink-0 rounded-lg object-cover bg-border" />
        ) : (
          <div className="w-[76px] h-[76px] shrink-0 rounded-lg bg-border flex items-center justify-center text-muted">
            <Icon name="home" className="text-2xl" />
          </div>
        )}
        <div className="min-w-0 flex flex-col justify-center">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Your ad</span>
          <span className="font-bold text-[15px] leading-snug line-clamp-2">{card.title}</span>
          <span className="mt-0.5 flex items-center gap-1 text-[12.5px] text-text-soft">
            <Icon name="pin" className="text-xs shrink-0" />
            <span className="truncate">{card.location}</span>
          </span>
        </div>
      </div>

      <div className="p-3.5 pt-3">
        <div className="font-lora font-bold text-[17px] leading-snug">{card.headline}</div>
        {card.paragraphs.map((paragraph) => (
          <p key={paragraph} className="m-0 mt-2 text-[13.5px] leading-relaxed text-text-soft">
            {paragraph}
          </p>
        ))}
        <Link
          href={card.ctaPath}
          className="mt-3.5 flex items-center justify-center gap-2 rounded-lg bg-green text-on-green py-2.5 text-[14px] font-bold no-underline"
        >
          {card.ctaLabel}
        </Link>
      </div>
    </div>
  );
}
