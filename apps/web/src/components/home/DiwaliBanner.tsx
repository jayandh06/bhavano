import Link from "next/link";
import { LISTINGS_ANCHOR_ID } from "@/components/home/AdLandingCard";

/** The Diwali greeting at the top of the home page (shown by app/page.tsx while lib/festive.ts says so). A server component with inline SVG and
 * CSS only: no images to download, no client JavaScript, and a fixed height so it cannot shift the page. It carries its own dark green and
 * saffron colours, so it reads the same in light and dark mode. The flames flicker only when the visitor has not asked for reduced motion. */

/** The gradients every lamp uses, defined once in an SVG that is not display:none (browsers skip gradients defined inside hidden SVGs). */
function DiyaDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <defs>
        <radialGradient id="diya-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd36b" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffd36b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="diya-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#ff8a1f" />
          <stop offset="100%" stopColor="#ffe27a" />
        </linearGradient>
        <linearGradient id="diya-bowl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e9b95c" />
          <stop offset="100%" stopColor="#a8651f" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Diya({ size, flameClass, glow = true }: { size: number; flameClass: string; glow?: boolean }) {
  return (
    <svg width={size} height={size * 0.78} viewBox="0 0 60 47" aria-hidden focusable="false">
      {glow && <circle cx="30" cy="14" r="22" fill="url(#diya-glow)" />}
      <g className={`diya-flame ${flameClass}`}>
        <path d="M30 1c7 8 9 14 0 22-9-8-7-14 0-22z" fill="url(#diya-flame)" />
        <path d="M30 10c3 4 4 7 0 11-4-4-3-7 0-11z" fill="#fff4c2" opacity="0.9" />
      </g>
      <path d="M3 26h54c-1 11-12 19-27 19S4 37 3 26z" fill="url(#diya-bowl)" />
      <ellipse cx="30" cy="26" rx="27" ry="3.2" fill="#f6d27f" />
      <path d="M12 33c6 5 30 5 36 0" fill="none" stroke="#7a4311" strokeOpacity="0.35" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function Spark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={`diwali-spark absolute ${className ?? ""}`} style={style} width="14" height="14" viewBox="0 0 14 14" aria-hidden focusable="false">
      <path d="M7 0l1.6 5.4L14 7l-5.4 1.6L7 14 5.4 8.6 0 7l5.4-1.6z" fill="#ffe9a8" />
    </svg>
  );
}

export function DiwaliBanner() {
  return (
    <section
      aria-label="Happy Diwali"
      className="relative mb-5 overflow-hidden rounded-2xl text-[#fff7e6] min-h-[140px] sm:min-h-[132px]"
      style={{ background: "linear-gradient(115deg, #0b3d2e 0%, #5b2a14 55%, #b4631a 100%)" }}
    >
      {/* Marigold toran along the top edge. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[14px] opacity-95"
        style={{
          backgroundImage:
            "radial-gradient(circle at 9px 7px, #ff9d1c 4.5px, transparent 5.5px), radial-gradient(circle at 9px 7px, #ffd24d 7px, transparent 8px)",
          backgroundSize: "18px 14px",
        }}
      />
      <DiyaDefs />
      <Spark className="left-[46%] top-6" />
      <Spark className="left-[58%] top-12" style={{ animationDelay: "-1s" }} />
      <Spark className="left-[8%] bottom-4" style={{ animationDelay: "-2s" }} />

      <div className="relative flex items-center justify-between gap-4 px-5 pt-7 pb-5 sm:px-8">
        <div className="min-w-0 flex-1">
          <p lang="hi" className="m-0 text-[12px] font-bold tracking-[0.18em] text-[#ffd98a]">
            शुभ दीपावली
          </p>
          <p className="font-lora m-0 mt-0.5 text-[21px] font-semibold leading-tight sm:text-[30px]">Happy Diwali from Bhavano</p>
          <p className="m-0 mt-1 hidden max-w-[520px] text-[14px] leading-snug text-[#fbe9c8] sm:block">
            May your home glow with light, joy and prosperity. Find the home you have been wishing for, or list yours free, with no brokerage.
          </p>
          <p className="m-0 mt-1 text-[13px] leading-snug text-[#fbe9c8] sm:hidden">A home full of light and joy to you and yours.</p>
          <div className="mt-3 flex gap-2">
            <Link
              href={`#${LISTINGS_ANCHOR_ID}`}
              className="whitespace-nowrap rounded-lg bg-[#ffd98a] px-3 py-2 text-[12.5px] sm:px-3.5 sm:text-[13px] font-bold text-[#3a1d0b] no-underline"
            >
              Browse homes
            </Link>
            <Link
              href="/post?from=diwali_banner"
              className="whitespace-nowrap rounded-lg border border-[#ffd98a]/70 px-3 py-2 text-[12.5px] sm:px-3.5 sm:text-[13px] font-bold text-[#ffe9b8] no-underline"
            >
              Post a free ad
            </Link>
          </div>
        </div>

        {/* The lamps: three on a wide screen, one on a phone. */}
        <div aria-hidden className="flex shrink-0 items-end gap-1 sm:gap-2">
          <div className="hidden sm:block">
            <Diya size={54} flameClass="diya-flame-b" glow={false} />
          </div>
          <div className="hidden sm:block">
            <Diya size={78} flameClass="" />
          </div>
          <Diya size={66} flameClass="diya-flame-c" />
        </div>
      </div>
    </section>
  );
}
