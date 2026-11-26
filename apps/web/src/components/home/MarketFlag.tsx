import { buildMarket } from "@/lib/marketRobots";

/** The small national flag beside the Bhavano title, so a visitor can tell www.bhavano.com (India) from www.bhavano.com/us (the US) at a glance. The market is the
 * build's. Inline SVG, not an emoji: Windows draws flag emoji as two letters. */
export function MarketFlag({ className = "", marketId }: { className?: string; marketId?: string }) {
  const us = buildMarket(marketId).id === "us";
  const label = us ? "United States" : "India";
  return (
    <span role="img" aria-label={label} title={label} className={`inline-flex shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/15 ${className}`}>
      {us ? <UsFlag /> : <IndiaFlag />}
    </span>
  );
}

function IndiaFlag() {
  return (
    <svg viewBox="0 0 30 20" width="21" height="14" aria-hidden="true" focusable="false">
      <path fill="#ff9933" d="M0 0h30v6.67H0z" />
      <path fill="#fff" d="M0 6.67h30v6.66H0z" />
      <path fill="#138808" d="M0 13.33h30V20H0z" />
      {/* The Ashoka Chakra: a navy wheel with 24 spokes. */}
      <g stroke="#000080" fill="none">
        <circle cx="15" cy="10" r="2.9" strokeWidth="0.55" />
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} strokeWidth="0.22" d="M15 7.1v5.8" transform={`rotate(${i * 15} 15 10)`} />
        ))}
      </g>
      <circle cx="15" cy="10" r="0.55" fill="#000080" />
    </svg>
  );
}

function UsFlag() {
  const stripe = 20 / 13;
  return (
    <svg viewBox="0 0 38 20" width="26.6" height="14" aria-hidden="true" focusable="false">
      <path fill="#fff" d="M0 0h38v20H0z" />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} y={i * 2 * stripe} width="38" height={stripe} fill="#b22234" />
      ))}
      <rect width="15.2" height={7 * stripe} fill="#3c3b6e" />
      {/* 50 stars in 9 staggered rows of 6 and 5; dots at this size. */}
      {Array.from({ length: 9 }, (_, row) =>
        Array.from({ length: row % 2 === 0 ? 6 : 5 }, (_, col) => (
          <circle key={`${row}-${col}`} cx={(row % 2 === 0 ? 1.27 : 2.53) + col * 2.53} cy={(row + 1) * ((7 * stripe) / 10)} r="0.45" fill="#fff" />
        )),
      )}
    </svg>
  );
}
