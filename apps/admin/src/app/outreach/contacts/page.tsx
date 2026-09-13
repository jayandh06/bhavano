import Link from "next/link";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchOutreachContacts, fetchOutreachContactCategories, fetchCities, fetchAreas } from "@/lib/bff";
import { buildPageHref, parsePage, parsePageSize, str } from "@/lib/searchParams";
import { OutreachContactsList } from "@/components/OutreachContactsList";
import { Pagination } from "@/components/Pagination";
import { SelectField } from "@/components/SelectField";

const textInputStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "8px 10px",
  fontSize: 13.5,
  background: "var(--surface)",
  color: "var(--text)",
  minWidth: 150,
};

const selectStyle: React.CSSProperties = { ...textInputStyle };

const applyButtonStyle: React.CSSProperties = {
  background: "var(--green)",
  color: "var(--on-green)",
  border: "none",
  borderRadius: 8,
  padding: "10px 16px",
  fontSize: 13.5,
  fontWeight: 700,
  cursor: "pointer",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>{label}</label>
      {children}
    </div>
  );
}

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

        <form
          method="get"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "flex-end",
            marginBottom: 20,
            padding: 16,
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "var(--surface)",
          }}
        >
          <Field label="Search">
            <input
              name="search"
              defaultValue={search ?? ""}
              placeholder="Name, phone or email"
              style={{ ...textInputStyle, minWidth: 220 }}
            />
          </Field>

          <Field label="Category">
            <SelectField name="businessCategory" defaultValue={businessCategory ?? ""} style={selectStyle}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectField>
          </Field>

          <Field label="City">
            <SelectField name="cityId" defaultValue={cityId ?? ""} style={selectStyle}>
              <option value="">All cities</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
          </Field>

          <Field label="Area">
            <SelectField
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
            </SelectField>
          </Field>

          <Field label="Consent">
            <SelectField name="consentState" defaultValue={consentState ?? ""} style={selectStyle}>
              <option value="">All consent states</option>
              <option value="none">None</option>
              <option value="implied">Implied</option>
              <option value="explicit">Explicit</option>
              <option value="opted_out">Opted out</option>
            </SelectField>
          </Field>

          <Field label="Listing">
            <SelectField name="hasListing" defaultValue={hasListing ?? ""} style={selectStyle}>
              <option value="">Listing: any</option>
              <option value="true">Listing created</option>
              <option value="false">No listing yet</option>
            </SelectField>
          </Field>

          <Field label="Notification">
            <SelectField name="notificationStatus" defaultValue={notificationStatus ?? ""} style={selectStyle}>
              <option value="">Notification: any</option>
              <option value="not_sent">Not sent</option>
              <option value="sent">Sent</option>
              <option value="confirmed">Confirmed (claimed)</option>
            </SelectField>
          </Field>

          {sort && <input type="hidden" name="sort" value={sort} />}
          <button type="submit" style={applyButtonStyle}>
            Apply filters
          </button>
          <Link href="/outreach/contacts" style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
            Reset
          </Link>
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
