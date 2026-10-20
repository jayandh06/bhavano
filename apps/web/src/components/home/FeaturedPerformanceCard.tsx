import type { FeaturedPerformanceDto } from "@bhavano/types/featuredPerformance";
import { perDay } from "@bhavano/types/featuredPerformance";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** What the owner's Featured period has produced so far — views, enquiries, contact reveals, and, when
 * the ad lived at least a day before being Featured, the views-per-day before vs now. Real counts only;
 * no comparison is shown without a "before" period to compare against. Server-rendered (no state). */
export function FeaturedPerformanceCard({ performance }: { performance: FeaturedPerformanceDto }) {
  const { before, daysFeatured } = performance;
  const stats: [label: string, value: number][] = [
    ["New viewers", performance.views],
    ["Enquiries", performance.enquiries],
    ["Contact reveals", performance.contactReveals],
  ];
  const viewsNow = perDay(performance.views, daysFeatured);
  const viewsBefore = before ? perDay(before.views, before.days) : 0;
  return (
    <div className="max-w-[720px] rounded-2xl border border-[color:var(--gold)]/40 bg-surface-alt/60 p-4 sm:p-5">
      <p className="font-lora font-bold text-[15px] text-text mt-0 mb-1">
        {performance.active ? "Your Featured ad so far" : "Your last Featured period"}
      </p>
      <p className="text-xs text-muted mt-0 mb-3">
        {formatDate(performance.since)} – {formatDate(performance.until)}
        {performance.active ? " · running now" : ""}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {stats.map(([label, value]) => (
          <div key={label} className="text-center">
            <div className="text-2xl font-bold text-green">{value}</div>
            <div className="text-xs text-muted">{label}</div>
          </div>
        ))}
      </div>
      {before && viewsBefore > 0 && viewsNow > 0 ? (
        <p className="text-[13px] text-text-soft mt-3 mb-0">
          About {viewsNow} new viewers a day while Featured, against {viewsBefore} a day before.
        </p>
      ) : performance.views === 0 && performance.active ? (
        <p className="text-[13px] text-text-soft mt-3 mb-0">
          No new viewers yet — share your ad on WhatsApp to get the first ones in.
        </p>
      ) : null}
    </div>
  );
}
