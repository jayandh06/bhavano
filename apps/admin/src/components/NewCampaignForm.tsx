"use client";

import { useState } from "react";
import type { OutreachChannel } from "@bhavano/types";
import { createCampaignAction } from "@/app/actions/outreach";

const input: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13,
  width: "100%",
};

export function NewCampaignForm() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [channel, setChannel] = useState<OutreachChannel>("sms");
  const [bodyTemplate, setBodyTemplate] = useState(
    "Hi {{name}}, list your property on Bhavano free. Reply STOP to opt out.",
  );
  const [dltTemplateId, setDltTemplateId] = useState("");
  const [cadenceCron, setCadenceCron] = useState("");
  const [minDaysBetweenSends, setMinDays] = useState(14);
  const [maxSendsPerRun, setMaxSends] = useState(200);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await createCampaignAction({
      name,
      channel,
      bodyTemplate,
      dltTemplateId: dltTemplateId || undefined,
      cadenceCron: cadenceCron || undefined,
      minDaysBetweenSends,
      maxSendsPerRun,
    });
    setPending(false);
    if (result.success) {
      setOpen(false);
      setName("");
    } else {
      setError(result.error);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--green)",
          background: "none",
          border: "1px solid var(--green)",
          borderRadius: 8,
          padding: "8px 16px",
          cursor: "pointer",
        }}
      >
        + New campaign
      </button>
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
        background: "var(--surface)",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14 }}>New campaign</div>

      <input style={input} placeholder="Campaign name" value={name} onChange={(e) => setName(e.target.value)} required />

      <select style={input} value={channel} onChange={(e) => setChannel(e.target.value as OutreachChannel)}>
        <option value="sms">SMS</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="email">Email</option>
      </select>

      <textarea
        style={{ ...input, minHeight: 80, fontFamily: "inherit" }}
        placeholder="Message body"
        value={bodyTemplate}
        onChange={(e) => setBodyTemplate(e.target.value)}
        required
      />
      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
        Placeholders: {"{{name}}"}, {"{{city}}"}, {"{{category}}"}. Must include an opt-out
        instruction (&quot;STOP&quot; or &quot;unsubscribe&quot;) before it can be activated.
      </span>

      <input
        style={input}
        placeholder="DLT template id (required for SMS/WhatsApp)"
        value={dltTemplateId}
        onChange={(e) => setDltTemplateId(e.target.value)}
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
          <input
            style={input}
            type="number"
            min={0}
            value={minDaysBetweenSends}
            onChange={(e) => setMinDays(Number(e.target.value))}
          />
        </label>
        <label style={{ fontSize: 12, color: "var(--muted)", flex: 1 }}>
          Max sends per run
          <input
            style={input}
            type="number"
            min={1}
            value={maxSendsPerRun}
            onChange={(e) => setMaxSends(Number(e.target.value))}
          />
        </label>
      </div>

      {error && <span style={{ fontSize: 12, color: "#b3413a" }}>{error}</span>}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          disabled={pending}
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#fff",
            background: "var(--green)",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            cursor: pending ? "default" : "pointer",
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? "Creating…" : "Create as draft"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
