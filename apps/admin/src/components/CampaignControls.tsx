"use client";

import { useState } from "react";
import type { CampaignPreviewDto, OutreachCampaignDto } from "@bhavano/types";
import { runCampaignAction, updateCampaignAction } from "@/app/actions/outreach";
import { previewCampaignAction } from "@/app/actions/outreachPreview";

const btn = (color: string): React.CSSProperties => ({
  fontSize: 12,
  fontWeight: 700,
  color,
  background: "none",
  border: `1px solid ${color}`,
  borderRadius: 8,
  padding: "6px 12px",
  cursor: "pointer",
});

/** Preview → activate → run. Preview is deliberately the first affordance: it's the only way to
 * see how many people a campaign would actually reach (and what the message resolves to) before
 * anything leaves the building. */
export function CampaignControls({ campaign }: { campaign: OutreachCampaignDto }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CampaignPreviewDto | null>(null);
  const [runSummary, setRunSummary] = useState<string | null>(null);

  async function onPreview() {
    setPending("preview");
    setError(null);
    const result = await previewCampaignAction(campaign.id);
    setPending(null);
    if (result.success) setPreview(result.preview);
    else setError(result.error);
  }

  async function onSetStatus(status: OutreachCampaignDto["status"]) {
    setPending(status);
    setError(null);
    const result = await updateCampaignAction(campaign.id, { status });
    setPending(null);
    if (!result.success) setError(result.error);
  }

  async function onToggleDryRun() {
    setPending("dryRun");
    setError(null);
    const result = await updateCampaignAction(campaign.id, { dryRun: !campaign.dryRun });
    setPending(null);
    if (!result.success) setError(result.error);
  }

  async function onRun() {
    setPending("run");
    setError(null);
    const result = await runCampaignAction(campaign.id);
    setPending(null);
    if (result.success) {
      setRunSummary(`${result.sent} sent · ${result.failed} failed · ${result.skipped} skipped`);
    } else {
      setError(result.error);
    }
  }

  const canActivate = campaign.status === "draft" || campaign.status === "paused";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button onClick={onPreview} disabled={pending !== null} style={btn("var(--text-soft)")}>
          {pending === "preview" ? "Checking…" : "Preview"}
        </button>
        <button onClick={onToggleDryRun} disabled={pending !== null} style={btn(campaign.dryRun ? "#b3413a" : "var(--muted)")}>
          {pending === "dryRun" ? "…" : campaign.dryRun ? "Dry run: on" : "Dry run: off"}
        </button>
        {canActivate ? (
          <button onClick={() => onSetStatus("scheduled")} disabled={pending !== null} style={btn("var(--green)")}>
            {pending === "scheduled" ? "…" : "Activate"}
          </button>
        ) : (
          <button onClick={() => onSetStatus("paused")} disabled={pending !== null} style={btn("var(--muted)")}>
            {pending === "paused" ? "…" : "Pause"}
          </button>
        )}
        <button onClick={onRun} disabled={pending !== null} style={btn("var(--green)")}>
          {pending === "run" ? "Running…" : "Run now"}
        </button>
      </div>

      {preview && (
        <div
          style={{
            fontSize: 11.5,
            color: "var(--muted)",
            textAlign: "right",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 10px",
            maxWidth: 340,
          }}
        >
          <div style={{ fontWeight: 700, color: "var(--text)" }}>
            {preview.eligibleCount} of {preview.audienceSize} would be messaged
          </div>
          <div>
            {preview.suppressedCount} suppressed/opted out · {preview.recentlyContactedCount} contacted too recently
          </div>
          {preview.sampleBodies.length > 0 && (
            <div style={{ marginTop: 6, textAlign: "left", whiteSpace: "pre-wrap" }}>
              {preview.sampleBodies.map((body, i) => (
                <div key={i} style={{ marginTop: 3, fontStyle: "italic" }}>
                  “{body}”
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {runSummary && <span style={{ fontSize: 11.5, color: "var(--green)" }}>{runSummary}</span>}
      {error && <span style={{ fontSize: 11, color: "#b3413a", maxWidth: 320, textAlign: "right" }}>{error}</span>}
    </div>
  );
}
