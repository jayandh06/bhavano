import Link from "next/link";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchOutreachContacts, fetchOutreachContactCategories, fetchCities, fetchAreas } from "@/lib/bff";
import { buildPageHref, parsePage, parsePageSize, str } from "@/lib/searchParams";
import { OutreachContactsList } from "@/components/OutreachContactsList";
import { Pagination } from "@/components/Pagination";

const selectStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13,
};

export default async function OutreachContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;
  const search = str(sp.search);
  const status = str(sp.status);
  const businessCategory = str(sp.businessCategory);
  const placesFetchLogId = str(sp.placesFetchLogId);
  const cityId = str(sp.cityId);
  const areaId = str(sp.areaId);
  const consentState = str(sp.consentState);
  const hasListing = str(sp.hasListing);
  const notificationStatus = str(sp.notificationStatus);
  const sort = str(sp.sort);
  const currentPage = parsePage(str(sp.page));
  const limit = parsePageSize(str(sp.limit));

  const [result, categories, cities, areas] = await Promise.all([
    fetchOutreachContacts(accessToken, {
      offset: (currentPage - 1) * limit,
      limit,
      search,
      status,
      businessCategory,
      placesFetchLogId,
      cityId,
      areaId,
      consentState,
      hasListing,
      notificationStatus,
      sort,
    }),
    fetchOutreachContactCategories(accessToken),
    fetchCities(undefined, true),
    // Only this city's areas — an area picker isn't meaningful before a city is chosen, same as
    // the post-ad location picker's own cascading behavior.
    cityId ? fetchAreas(cityId, undefined, true) : Promise.resolve([]),
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Outreach contacts</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 20px" }}>
          Prospects pulled from Google Maps, scrapes and CSV uploads — separate from real Bhavano
          users. Opting someone out here also adds them to the suppression list, so a later import
          can&apos;t resurrect them.{" "}
          <Link href="/outreach/campaigns" style={{ color: "var(--green)", fontWeight: 700 }}>
            Campaigns →
          </Link>{" "}
          <Link href="/outreach/scrapes" style={{ color: "var(--green)", fontWeight: 700 }}>
            Scrape history →
          </Link>
        </p>

        {placesFetchLogId && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
              padding: "10px 14px",
              border: "1px solid var(--border)",
              borderRadius: 10,
              background: "var(--surface)",
              fontSize: 13,
            }}
          >
            Showing only contacts from{" "}
            <Link href="/outreach/scrapes" style={{ fontWeight: 700, color: "var(--text)" }}>
              this scrape run
            </Link>
            .
            <Link
              href={buildPageHref("/outreach/contacts", { ...sp, placesFetchLogId: undefined }, 1)}
              style={{ marginLeft: "auto", color: "var(--muted)", fontWeight: 700 }}
            >
              Clear
            </Link>
          </div>
        )}

        <form method="get" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            name="search"
            defaultValue={search ?? ""}
            placeholder="Search name, phone or email"
            style={{
              flex: 1,
              minWidth: 220,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 13,
            }}
          />
          <select name="businessCategory" defaultValue={businessCategory ?? ""} style={selectStyle}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select name="cityId" defaultValue={cityId ?? ""} style={selectStyle}>
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            name="areaId"
            defaultValue={areaId ?? ""}
            disabled={!cityId}
            style={selectStyle}
            title={cityId ? undefined : "Pick a city first"}
          >
            <option value="">{cityId ? "All areas" : "All areas (pick a city first)"}</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select name="consentState" defaultValue={consentState ?? ""} style={selectStyle}>
            <option value="">All consent states</option>
            <option value="none">None</option>
            <option value="implied">Implied</option>
            <option value="explicit">Explicit</option>
            <option value="opted_out">Opted out</option>
          </select>
          <select name="hasListing" defaultValue={hasListing ?? ""} style={selectStyle}>
            <option value="">Listing: any</option>
            <option value="true">Listing created</option>
            <option value="false">No listing yet</option>
          </select>
          <select name="notificationStatus" defaultValue={notificationStatus ?? ""} style={selectStyle}>
            <option value="">Notification: any</option>
            <option value="not_sent">Not sent</option>
            <option value="sent">Sent</option>
            <option value="confirmed">Confirmed (claimed)</option>
          </select>
          {sort && <input type="hidden" name="sort" value={sort} />}
          <button
            type="submit"
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--green)",
              color: "var(--on-green, #fff)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </form>

        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px" }}>
          {result.total} contact{result.total === 1 ? "" : "s"}
        </p>

        <OutreachContactsList contacts={result.items} sp={sp} />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          buildHref={(p) => buildPageHref("/outreach/contacts", sp, p)}
          pageSize={limit}
          sp={sp}
        />
      </div>
    </div>
  );
}
