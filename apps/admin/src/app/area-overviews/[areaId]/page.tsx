import { requireAdmin } from "@/lib/requireAdmin";
import { fetchAreaOverview } from "@/lib/bff";
import { FullPageLink } from "@/components/FullPageLink";
import { AreaOverviewEditor } from "@/components/AreaOverviewEditor";

export default async function AreaOverviewEditPage({ params }: { params: Promise<{ areaId: string }> }) {
  const { accessToken } = await requireAdmin();
  const { areaId } = await params;
  const detail = await fetchAreaOverview(accessToken, areaId);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/area-overviews" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← All area overviews
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>
          {detail.areaName}, {detail.cityName}
        </h1>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 20px" }}>
          {detail.activeListings} active listing{detail.activeListings === 1 ? "" : "s"}. Editing approved or in-review
          text sends it back to draft, so it needs another review before it goes live.
        </p>
        <AreaOverviewEditor detail={detail} />
      </div>
    </div>
  );
}
