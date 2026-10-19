import { requireAdmin } from "@/lib/requireAdmin";
import { fetchCityOverview } from "@/lib/bff";
import { FullPageLink } from "@/components/FullPageLink";
import { AreaOverviewEditor } from "@/components/AreaOverviewEditor";
import { saveCityOverviewAction, setCityOverviewStatusAction } from "@/app/actions/city-overviews";

export default async function CityOverviewEditPage({ params }: { params: Promise<{ cityId: string }> }) {
  const { accessToken } = await requireAdmin();
  const { cityId } = await params;
  const detail = await fetchCityOverview(accessToken, cityId);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/city-overviews" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← All city overviews
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>{detail.cityName}</h1>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 20px" }}>
          {detail.activeListings} active listing{detail.activeListings === 1 ? "" : "s"}. Editing approved or in-review
          text sends it back to draft, so it needs another review before it goes live.
        </p>
        <AreaOverviewEditor
          subjectId={detail.cityId}
          previewTitle={`About ${detail.cityName}`}
          overview={detail.overview}
          save={saveCityOverviewAction}
          setStatus={setCityOverviewStatusAction}
        />
      </div>
    </div>
  );
}
