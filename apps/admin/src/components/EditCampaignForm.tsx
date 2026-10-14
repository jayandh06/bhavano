"use client";

import { useState } from "react";
import type { OutreachCampaignDto } from "@bhavano/types";
import { updateCampaignAction } from "@/app/actions/outreach";

const input: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13,
  width: "100%",
};

const linkButton: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text-soft)",
  background: "none",
  border: "1px solid var(--text-soft)",
  borderRadius: 8,
  padding: "6px 12px",
  cursor: "pointer",
};

/** Edits a campaign that is not live. Only drafts and paused campaigns are editable: changing the
 * body or audience of a scheduled/running campaign would change what the next tick sends to a
 * different set of people than the one that was previewed. Channel is not editable — a body and
 * DLT template written for SMS don't carry over to another channel.
 *
 * The audience here is the contact tags only; any other filter fields already on the campaign
 * (cities, categories, rating, statuses) are kept as they are. */
export function EditCampaignForm({ campaign }: { campaign: OutreachCampaignDto }) {
  const editable = campaign.status === "draft" || campaign.status === "paused";

  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState(campaign.name);
  const [bodyTemplate, setBodyTemplate] = useState(campaign.bodyTemplate);
  const [dltTemplateId, setDltTemplateId] = useState(campaign.dltTemplateId ?? "");
  const [tags, setTags] = useState((campaign.audienceFilter.tags ?? []).join(", "));
  const [cadenceCron, setCadenceCron] = useState(campaign.cadenceCron ?? "");
  const [minDaysBetweenSends, setMinDays] = useState(campaign.minDaysBetweenSends);
  const [maxSendsPerRun, setMaxSends] = useState(campaign.maxSendsPerRun);

  if (!editable) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const { tags: _previousTags, ...otherFilters } = campaign.audienceFilter;
    const result = await updateCampaignAction(campaign.id, {
      name,
      bodyTemplate,
      dltTemplateId,
      audienceFilter: tagList.length > 0 ? { ...otherFilters, tags: tagList } : otherFilters,
      cadenceCron,
      minDaysBetweenSends,
      maxSendsPerRun,
    });
    setPending(false);

    if (result.success) {
      setSaved(true);
      setOpen(false);
    } else {
      setError(result.error);
    }
  }

  if (!open) {
    return (
      <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={() => { setOpen(true); setSaved(false); }} style={linkButton}>
          Edit
        </button>
        {saved && <span style={{ fontSize: 12, color: "var(--green)" }}>Saved. Preview again to see the audience.</span>}
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 16,
        marginTop: 10,
        background: "var(--surface)",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14 }}>Edit campaign</div>

      <input style={input} placeholder="Campaign name" value={name} onChange={(e) => setName(e.target.value)} required />

      <textarea
        style={{ ...input, minHeight: 80, fontFamily: "inherit" }}
        placeholder="Message body"
        value={bodyTemplate}
        onChange={(e) => setBodyTemplate(e.target.value)}
        required
      />
      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
        For SMS the body must match the DLT-registered template text exactly, including the opt-out line.
      </span>

      <input
        style={input}
        placeholder="DLT / MSG91 template id (required for SMS/WhatsApp)"
        value={dltTemplateId}
        onChange={(e) => setDltTemplateId(e.target.value)}
      />
      <input
        style={input}
        placeholder="Audience: contact tags, comma-separated (e.g. portal-agent)"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
      />
      <input
        style={input}
        placeholder="Cadence cron — leave blank for a one-shot campaign"
        value={cadenceCron}
        onChange={(e) => setCadenceCron(e.target.value)}
      />

      <div style={{ display: "flex", gap: 10 }}>
        <label style={{ fontSize: 12, color: "var(--muted)", flex: 1 }}>
          Min days between sends
          <input style={input} type="number" min={0} value={minDaysBetweenSends} onChange={(e) => setMinDays(Number(e.target.value))} />
        </label>
        <label style={{ fontSize: 12, color: "var(--muted)", flex: 1 }}>
          Max sends per run
          <input style={input} type="number" min={1} value={maxSendsPerRun} onChange={(e) => setMaxSends(Number(e.target.value))} />
        </label>
      </div>

      {error && <span style={{ fontSize: 12, color: "#b3413a" }}>{error}</span>}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={pending} style={{ ...linkButton, color: "var(--green)", border: "1px solid var(--green)" }}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={pending} style={linkButton}>
          Cancel
        </button>
      </div>
    </form>
  );
}
