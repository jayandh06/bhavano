import Link from "next/link";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchCampaigns } from "@/lib/bff";
import { CampaignControls } from "@/components/CampaignControls";
import { NewCampaignForm } from "@/components/NewCampaignForm";

const STATUS_COLORS: Record<string, string> = {
  draft: "var(--muted)",
  scheduled: "var(--text-soft)",
  running: "var(--green)",
  paused: "#b3413a",
  completed: "var(--muted)",
};

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { accessToken } = await requireAdmin();
  const sp = await searchParams;
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;

  const page = await fetchCampaigns(accessToken, { cursor, limit: 50 });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Campaigns</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 8px" }}>
          Promotional SMS/WhatsApp to outreach contacts.{" "}
          <Link href="/outreach/contacts" style={{ color: "var(--green)", fontWeight: 700 }}>
            Contacts →
          </Link>
        </p>
        <p
          style={{
            fontSize: 12.5,
            color: "var(--muted)",
            margin: "0 0 20px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 12px",
            background: "var(--surface)",
          }}
        >
          New campaigns start in <strong>dry run</strong> — the runner records what it would have
          sent without contacting anyone. Turn that off (and set <code>MSG91_MARKETING_ENABLED=true</code>{" "}
          on the BFF) only once a preview looks right. Activating an SMS/WhatsApp campaign requires
          a DLT template id and an opt-out instruction in the body.
        </p>

        <NewCampaignForm />

        {page.items.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 24 }}>No campaigns yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
            {page.items.map((campaign) => (
              <div
                key={campaign.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 14,
                  background: "var(--surface)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{campaign.name}</span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: STATUS_COLORS[campaign.status] ?? "var(--muted)",
                          border: `1px solid ${STATUS_COLORS[campaign.status] ?? "var(--border)"}`,
                          borderRadius: 6,
                          padding: "2px 8px",
                        }}
                      >
                        {campaign.status}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{campaign.channel}</span>
                      {campaign.dryRun && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#b3413a",
                            border: "1px solid #b3413a",
                            borderRadius: 6,
                            padding: "2px 8px",
                          }}
                        >
                          dry run
                        </span>
                      )}
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
                      {campaign.bodyTemplate}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
                      {`sent ${campaign.stats.sent} · failed ${campaign.stats.failed} · suppressed ${campaign.stats.suppressed}`}
                      {campaign.lastRunAt &&
                        ` · last run ${new Date(campaign.lastRunAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}`}
                      {campaign.cadenceCron ? ` · repeats (${campaign.cadenceCron})` : " · one-shot"}
                    </div>
                    <Link
                      href={`/outreach/sends?campaignId=${campaign.id}`}
                      style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", marginTop: 6, display: "inline-block" }}
                    >
                      View send history →
                    </Link>
                  </div>
                  <CampaignControls campaign={campaign} />
                </div>
              </div>
            ))}
          </div>
        )}

        {page.nextCursor && (
          <Link
            href={`/outreach/campaigns?cursor=${page.nextCursor}`}
            style={{ display: "inline-block", marginTop: 16, fontSize: 13, fontWeight: 700, color: "var(--green)" }}
          >
            Next page →
          </Link>
        )}
      </div>
    </div>
  );
}
