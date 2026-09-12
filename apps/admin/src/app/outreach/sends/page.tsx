import Link from "next/link";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchCampaignSends, fetchClaimVerificationSends } from "@/lib/bff";
import { buildPageHref, parsePage, parsePageSize, str, type SearchParams } from "@/lib/searchParams";
import { Pagination } from "@/components/Pagination";
import { formatDateTime } from "@/lib/formatDateTime";

const STATUS_COLORS: Record<string, string> = {
  queued: "var(--muted)",
  sent: "var(--green)",
  delivered: "var(--green)",
  read: "var(--green)",
  failed: "#b3413a",
  suppressed: "var(--muted)",
  opted_out: "#b3413a",
};

export default async function SendsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;
  const campaignId = str(sp.campaignId);
  const contactId = str(sp.contactId);
  const currentPage = parsePage(str(sp.page));
  const limit = parsePageSize(str(sp.limit));

  const [result, claimVerificationSends] = await Promise.all([
    fetchCampaignSends(accessToken, {
      offset: (currentPage - 1) * limit,
      limit,
      campaignId,
      contactId,
    }),
    // Only meaningful scoped to one contact — a claim-verification send has no "campaign" to
    // list generally, it's always tied to one specific business's one specific listing.
    contactId ? fetchClaimVerificationSends(accessToken, contactId) : Promise.resolve([]),
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <Link
          href={contactId ? "/outreach/contacts" : "/outreach/campaigns"}
          style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}
        >
          ← Back to {contactId ? "contacts" : "campaigns"}
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Send history</h1>

        {contactId && (
          <>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: "20px 0 4px" }}>Claim verification</h2>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
              Every "claim your listing" attempt for this contact's business, one row per channel.{" "}
              {/* Success is only ever proven by a claim happening, or (WhatsApp only) an MSG91
                * delivery/read webhook — a row that just says "email" with no further status
                * means "sent, and nothing more is knowable" for that channel, not "delivered". */}
              {claimVerificationSends.length} record{claimVerificationSends.length === 1 ? "" : "s"}.
            </p>
            {claimVerificationSends.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>
                No claim-verification send attempted for this contact yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                {claimVerificationSends.map((send) => (
                  <div
                    key={send.id}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: 14,
                      background: "var(--surface)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{send.channel}</span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: STATUS_COLORS[send.deliveryStatus ?? "sent"] ?? "var(--muted)",
                          border: `1px solid ${STATUS_COLORS[send.deliveryStatus ?? "sent"] ?? "var(--border)"}`,
                          borderRadius: 6,
                          padding: "2px 8px",
                        }}
                      >
                        {send.deliveryStatus ?? "sent"}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
                      Sent {formatDateTime(send.sentAt)}
                      {send.deliveryStatusAt &&
                        send.deliveryStatus &&
                        send.deliveryStatus !== "failed" &&
                        ` · ${send.deliveryStatus} ${formatDateTime(send.deliveryStatusAt)}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>Campaign sends</h2>
          </>
        )}

        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
          Every send attempt, newest first — including ones that were suppressed or skipped, so the
          gap between an audience and what actually went out is always explainable. {result.total}{" "}
          record{result.total === 1 ? "" : "s"}.
        </p>

        {result.items.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Nothing sent yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.items.map((send) => (
              <div
                key={send.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 14,
                  background: "var(--surface)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{send.contactName}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: STATUS_COLORS[send.status] ?? "var(--muted)",
                      border: `1px solid ${STATUS_COLORS[send.status] ?? "var(--border)"}`,
                      borderRadius: 6,
                      padding: "2px 8px",
                    }}
                  >
                    {send.status.replace("_", " ")}
                  </span>
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    {send.campaignName} · {send.channel} · run {send.runKey}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--muted)",
                    marginTop: 6,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {send.renderedBody}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
                  {send.sentAt ? `Sent ${formatDateTime(send.sentAt)}` : `Created ${formatDateTime(send.createdAt)}`}
                  {send.failureReason && ` · ${send.failureReason}`}
                </div>
              </div>
            ))}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          buildHref={(p) => buildPageHref("/outreach/sends", sp, p)}
          pageSize={limit}
          sp={sp}
        />
      </div>
    </div>
  );
}
