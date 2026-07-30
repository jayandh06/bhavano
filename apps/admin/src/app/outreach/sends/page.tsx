import Link from "next/link";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchCampaignSends } from "@/lib/bff";
import { str } from "@/lib/searchParams";

const STATUS_COLORS: Record<string, string> = {
  queued: "var(--muted)",
  sent: "var(--green)",
  delivered: "var(--green)",
  failed: "#b3413a",
  suppressed: "var(--muted)",
  opted_out: "#b3413a",
};

export default async function SendsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;
  const campaignId = str(sp.campaignId);
  const contactId = str(sp.contactId);

  const page = await fetchCampaignSends(accessToken, {
    cursor: str(sp.cursor),
    limit: 50,
    campaignId,
    contactId,
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
        <Link
          href={contactId ? "/outreach/contacts" : "/outreach/campaigns"}
          style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}
        >
          ← Back to {contactId ? "contacts" : "campaigns"}
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Send history</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 20px" }}>
          Every send attempt, newest first — including ones that were suppressed or skipped, so the
          gap between an audience and what actually went out is always explainable. {page.total}{" "}
          record{page.total === 1 ? "" : "s"}.
        </p>

        {page.items.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Nothing sent yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {page.items.map((send) => (
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
                  {send.sentAt
                    ? `Sent ${new Date(send.sentAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
                    : `Created ${new Date(send.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`}
                  {send.failureReason && ` · ${send.failureReason}`}
                </div>
              </div>
            ))}
          </div>
        )}

        {page.nextCursor && (
          <Link
            href={`/outreach/sends?${new URLSearchParams({
              ...(campaignId ? { campaignId } : {}),
              ...(contactId ? { contactId } : {}),
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
