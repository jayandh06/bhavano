import Link from "next/link";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchOutreachContacts } from "@/lib/bff";
import { str } from "@/lib/searchParams";
import { OptOutButton } from "@/components/OptOutButton";

const CONSENT_COLORS: Record<string, string> = {
  none: "var(--muted)",
  implied: "var(--text-soft)",
  explicit: "var(--green)",
  opted_out: "#b3413a",
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

  const page = await fetchOutreachContacts(accessToken, {
    cursor: str(sp.cursor),
    limit: 50,
    search,
    status,
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Outreach contacts</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 20px" }}>
          Prospects pulled from Google Maps, scrapes and CSV uploads — separate from real Bhavano
          users. Opting someone out here also adds them to the suppression list, so a later import
          can&apos;t resurrect them.{" "}
          <Link href="/outreach/campaigns" style={{ color: "var(--green)", fontWeight: 700 }}>
            Campaigns →
          </Link>
        </p>

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
          {page.total} contact{page.total === 1 ? "" : "s"}
        </p>

        {page.items.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No contacts yet — import some to get started.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {page.items.map((contact) => (
              <div
                key={contact.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 14,
                  background: "var(--surface)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{contact.name}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: CONSENT_COLORS[contact.consentState] ?? "var(--muted)",
                        border: `1px solid ${CONSENT_COLORS[contact.consentState] ?? "var(--border)"}`,
                        borderRadius: 6,
                        padding: "2px 8px",
                      }}
                    >
                      {contact.consentState.replace("_", " ")}
                    </span>
                    {contact.googleRating != null && (
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        ★ {contact.googleRating} ({contact.googleReviewCount ?? 0})
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>
                    {[contact.phoneE164 ?? contact.phone, contact.email, contact.cityName, contact.businessCategory]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
                    {contact.contactedCount === 0
                      ? "Never contacted"
                      : `Contacted ${contact.contactedCount}× · last ${new Date(
                          contact.lastContactedAt!,
                        ).toLocaleDateString("en-IN", { dateStyle: "medium" })}`}
                    {" · via "}
                    {contact.source.replace("_", " ")}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Link
                    href={`/outreach/sends?contactId=${contact.id}`}
                    style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}
                  >
                    History
                  </Link>
                  {contact.consentState !== "opted_out" && <OptOutButton contactId={contact.id} />}
                </div>
              </div>
            ))}
          </div>
        )}

        {page.nextCursor && (
          <Link
            href={`/outreach/contacts?${new URLSearchParams({
              ...(search ? { search } : {}),
              ...(status ? { status } : {}),
              cursor: page.nextCursor,
            }).toString()}`}
            style={{ display: "inline-block", marginTop: 16, fontSize: 13, fontWeight: 700, color: "var(--green)" }}
          >
            Next page →
          </Link>
        )}
      </div>
    </div>
  );
}
