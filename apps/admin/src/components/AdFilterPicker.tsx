"use client";

import { useMemo, useState } from "react";
import type { PageVisitAdOptionsDto } from "@bhavano/types/pageVisitAdOptions";

/** `none` in either list means "not from an ad" — the same word the BFF reads (see adIdClause). */
const NONE = "none";

const splitIds = (raw: string | undefined) => (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/** The Campaign and Ad group filters on Page visits: two checklist dropdowns that submit with the
 * surrounding form as one comma-separated value each. The ad group list follows the campaigns
 * ticked beside it (every group while none is), and a group that drops out of that list is also
 * dropped from the selection, so the form never submits a combination that can match nothing. */
export function AdFilterPicker({
  options,
  defaultCampaignIds,
  defaultAdGroupIds,
}: {
  options: PageVisitAdOptionsDto;
  defaultCampaignIds: string | undefined;
  defaultAdGroupIds: string | undefined;
}) {
  const [campaigns, setCampaigns] = useState<string[]>(() => splitIds(defaultCampaignIds));
  const [adGroups, setAdGroups] = useState<string[]>(() => splitIds(defaultAdGroupIds));

  const realCampaigns = campaigns.filter((c) => c !== NONE);
  const visibleGroups = useMemo(
    () =>
      realCampaigns.length === 0
        ? options.adGroups
        : options.adGroups.filter((g) => g.campaignId !== null && realCampaigns.includes(g.campaignId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options.adGroups, campaigns],
  );

  function changeCampaigns(next: string[]) {
    setCampaigns(next);
    const real = next.filter((c) => c !== NONE);
    if (real.length === 0) return;
    const allowed = new Set(options.adGroups.filter((g) => g.campaignId !== null && real.includes(g.campaignId)).map((g) => g.id));
    setAdGroups((current) => current.filter((id) => id === NONE || allowed.has(id)));
  }

  return (
    <>
      <Dropdown
        label="Campaign"
        allLabel="All campaigns"
        name="campaignId"
        selected={campaigns}
        onChange={changeCampaigns}
        items={[
          { value: NONE, label: "No ad (not from Google Ads)" },
          ...options.campaigns.map((c) => ({ value: c.id, label: c.name, count: c.visits })),
        ]}
      />
      <Dropdown
        label="Ad group"
        allLabel={realCampaigns.length ? "All ad groups in these campaigns" : "All ad groups"}
        name="adGroupId"
        selected={adGroups}
        onChange={setAdGroups}
        items={[
          { value: NONE, label: "No ad group" },
          ...visibleGroups.map((g) => ({
            value: g.id,
            label: g.name,
            // Naming the campaign only helps while several are in play.
            hint: realCampaigns.length !== 1 ? (g.campaignName ?? undefined) : undefined,
            count: g.visits,
          })),
        ]}
      />
    </>
  );
}

interface Item {
  value: string;
  label: string;
  hint?: string;
  count?: number;
}

function Dropdown({
  label,
  allLabel,
  name,
  selected,
  onChange,
  items,
}: {
  label: string;
  allLabel: string;
  name: string;
  selected: string[];
  onChange: (next: string[]) => void;
  items: Item[];
}) {
  const [query, setQuery] = useState("");
  const shown = query ? items.filter((i) => `${i.label} ${i.hint ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())) : items;
  const byValue = new Map(items.map((i) => [i.value, i.label]));
  const summary =
    selected.length === 0 ? allLabel : selected.length === 1 ? (byValue.get(selected[0]) ?? selected[0]) : `${selected.length} selected`;

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>{label}</label>
      <details style={{ position: "relative" }}>
        <summary
          style={{
            listStyle: "none",
            cursor: "pointer",
            border: "1px solid var(--border)",
            borderRadius: 9,
            padding: "8px 28px 8px 10px",
            fontSize: 13.5,
            background: "var(--surface)",
            color: "var(--text)",
            minWidth: 190,
            maxWidth: 260,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            position: "relative",
          }}
        >
          {summary}
          <span style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--muted)" }}>▾</span>
        </summary>
        <div
          style={{
            position: "absolute",
            zIndex: 20,
            top: "calc(100% + 4px)",
            left: 0,
            minWidth: 300,
            maxWidth: 420,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 9,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            padding: 8,
          }}
        >
          {items.length > 8 && (
            <input
              placeholder={`Search ${label.toLowerCase()}s`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                marginBottom: 6,
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                fontSize: 12.5,
              }}
            />
          )}
          <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {shown.length === 0 && <span style={{ fontSize: 12, color: "var(--muted)", padding: 4 }}>Nothing to choose from.</span>}
            {shown.map((i) => (
              <label key={i.value} style={{ fontSize: 12.5, display: "flex", gap: 7, alignItems: "flex-start", cursor: "pointer", padding: "3px 4px" }}>
                <input type="checkbox" checked={selected.includes(i.value)} onChange={() => toggle(i.value)} style={{ marginTop: 2 }} />
                <span>
                  {i.label}
                  {i.count !== undefined && <span style={{ color: "var(--muted)" }}> ({i.count.toLocaleString()})</span>}
                  {i.hint && <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>{i.hint}</span>}
                </span>
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              style={{ marginTop: 6, background: "none", border: "none", padding: 0, fontSize: 12, fontWeight: 700, color: "var(--muted)", cursor: "pointer" }}
            >
              Clear selection
            </button>
          )}
        </div>
      </details>
      {/* One comma-joined value, so the URL stays ?campaignId=1,2 and a single id still works as before. */}
      <input type="hidden" name={name} value={selected.join(",")} />
    </div>
  );
}
