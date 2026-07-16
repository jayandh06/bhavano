"use client";

import { useEffect, useState } from "react";
import type { City, UserProfileDto } from "@bhavano/types";
import { autoDetectCityAction, searchCitiesAction } from "@/app/actions/locations";
import { updateProfileAction } from "@/app/actions/users";

export function ProfileForm({ profile }: { profile: UserProfileDto }) {
  const [name, setName] = useState(profile.name ?? "");
  const [cityId, setCityId] = useState(profile.cityId ?? undefined);
  const [cityName, setCityName] = useState(profile.cityName ?? "");
  const [state, setState] = useState(profile.state ?? "");
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [showCityResults, setShowCityResults] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [detected, setDetected] = useState(false);

  // No saved city yet — try to auto-detect one from the browser's geolocation so there's a
  // sensible default to review/confirm, instead of an empty required-feeling field.
  useEffect(() => {
    if (profile.cityId || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const city = await autoDetectCityAction(pos.coords.latitude, pos.coords.longitude);
      if (city) {
        setCityId(city.id);
        setCityName(city.name);
        setState(city.state);
        setDetected(true);
      }
    });
    // Only ever attempt this once, on first load with no saved city — not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCityQueryChange(value: string) {
    setCityQuery(value);
    if (!value) {
      setCityResults([]);
      setShowCityResults(false);
      return;
    }
    setCityResults(await searchCitiesAction(value));
    setShowCityResults(true);
  }

  function selectCity(city: City) {
    setCityId(city.id);
    setCityName(city.name);
    setState(city.state);
    setCityQuery("");
    setShowCityResults(false);
    setDetected(false);
  }

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateProfileAction({ name: name.trim() || undefined, cityId });
    setSaving(false);
    setDetected(false);
    setMessage(
      result.success ? { type: "success", text: "Profile updated." } : { type: "error", text: result.error ?? "Failed to update profile" },
    );
  }

  return (
    <div style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <label style={labelStyle}>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle}>Email</label>
        <div style={readOnlyStyle}>{profile.email ?? "—"}</div>
      </div>

      <div>
        <label style={labelStyle}>Phone</label>
        <div style={readOnlyStyle}>{profile.phone ?? "—"}</div>
      </div>

      <div style={{ position: "relative" }}>
        <label style={labelStyle}>City</label>
        {detected && (
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 8px" }}>
            📍 We detected your location as below — confirm or search for a different city before saving.
          </p>
        )}
        <input
          value={cityQuery || (cityName ? `${cityName}${state ? `, ${state}` : ""}` : "")}
          onChange={(e) => {
            setCityName("");
            setState("");
            onCityQueryChange(e.target.value);
          }}
          onFocus={() => cityResults.length > 0 && setShowCityResults(true)}
          placeholder="Search for your city"
          style={inputStyle}
        />
        {showCityResults && cityResults.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              zIndex: 20,
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            {cityResults.map((city) => (
              <button
                key={city.id}
                onClick={() => selectCity(city)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  padding: "10px 14px",
                  fontSize: 14,
                  color: "var(--text)",
                  cursor: "pointer",
                }}
              >
                {city.name}, {city.state}
              </button>
            ))}
          </div>
        )}
      </div>

      {message && (
        <p style={{ fontSize: 13, color: message.type === "success" ? "var(--green)" : "#b3413a", margin: 0 }}>
          {message.text}
        </p>
      )}

      <button onClick={onSave} disabled={saving} style={saveButtonStyle}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--muted)",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.02em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "12px 14px",
  fontSize: 14,
  outline: "none",
  background: "var(--surface)",
  color: "var(--text)",
};

const readOnlyStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "12px 14px",
  fontSize: 14,
  background: "var(--surface-alt)",
  color: "var(--text-soft)",
};

const saveButtonStyle: React.CSSProperties = {
  background: "var(--green)",
  color: "var(--on-green)",
  border: "none",
  borderRadius: 8,
  padding: 13,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};
