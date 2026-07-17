"use client";

import { useEffect, useState } from "react";
import type { City, UserProfileDto } from "@bhavano/types";
import { autoDetectCityAction, searchCitiesAction } from "@/app/actions/locations";
import { updateProfileAction } from "@/app/actions/users";
import { linkPhoneAction, sendOtpAction } from "@/app/actions/auth";

type PhoneStep = "idle" | "otpSent";

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

  const [email, setEmail] = useState(profile.email ?? "");

  const [currentPhone, setCurrentPhone] = useState(profile.phone);
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("idle");
  const [phoneInput, setPhoneInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [phonePending, setPhonePending] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const emailMissing = !profile.email && email.trim().length === 0;
  const canSave = !!currentPhone && !emailMissing;

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

  async function onSendPhoneOtp() {
    setPhonePending(true);
    setPhoneError(null);
    const result = await sendOtpAction(phoneInput);
    setPhonePending(false);
    if (result.success) {
      setPhoneStep("otpSent");
    } else {
      setPhoneError(result.error ?? "Failed to send OTP");
    }
  }

  async function onVerifyPhoneOtp() {
    setPhonePending(true);
    setPhoneError(null);
    const result = await linkPhoneAction(phoneInput, otpInput);
    setPhonePending(false);
    if (result.success) {
      setCurrentPhone(phoneInput);
      setPhoneStep("idle");
      setOtpInput("");
    } else {
      setPhoneError(result.error ?? "Incorrect OTP");
    }
  }

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateProfileAction({
      name: name.trim() || undefined,
      cityId,
      email: !profile.email && email.trim() ? email.trim() : undefined,
    });
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
        <label style={labelStyle}>
          Email {!profile.email && <span style={{ color: "#b3413a" }}>*</span>}
        </label>
        {profile.email ? (
          <div style={readOnlyStyle}>{profile.email}</div>
        ) : (
          <>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 8px" }}>
              You signed in with your phone number — add an email so we have another way to reach you.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
            />
          </>
        )}
      </div>

      <div>
        <label style={labelStyle}>
          Phone {!currentPhone && <span style={{ color: "#b3413a" }}>*</span>}
        </label>
        {currentPhone ? (
          <div style={readOnlyStyle}>{currentPhone}</div>
        ) : (
          <>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 8px" }}>
              You signed in with Google — add and verify a phone number so buyers/sellers can reach you.
            </p>
            {phoneStep === "idle" ? (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={countryChipStyle}>+91</div>
                  <input
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="10-digit mobile number"
                    style={inputStyle}
                  />
                </div>
                {phoneError && <p style={errorStyle}>{phoneError}</p>}
                <button
                  onClick={onSendPhoneOtp}
                  disabled={phoneInput.length !== 10 || phonePending}
                  style={{ ...secondaryButtonStyle, opacity: phoneInput.length === 10 ? 1 : 0.5, marginTop: 10 }}
                >
                  {phonePending ? "Sending…" : "Send OTP"}
                </button>
              </>
            ) : (
              <>
                <input
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="······"
                  style={{ ...inputStyle, textAlign: "center", letterSpacing: "0.4em" }}
                />
                {phoneError && <p style={errorStyle}>{phoneError}</p>}
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button
                    onClick={onVerifyPhoneOtp}
                    disabled={otpInput.length !== 6 || phonePending}
                    style={{ ...secondaryButtonStyle, opacity: otpInput.length === 6 ? 1 : 0.5 }}
                  >
                    {phonePending ? "Verifying…" : "Verify & link"}
                  </button>
                  <button
                    onClick={() => {
                      setPhoneStep("idle");
                      setPhoneError(null);
                    }}
                    style={backButtonStyle}
                  >
                    ← Back
                  </button>
                </div>
              </>
            )}
          </>
        )}
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

      {!canSave && (
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
          {!currentPhone && emailMissing
            ? "Add your email above and verify your phone number above before saving."
            : !currentPhone
              ? "Verify your phone number above before saving."
              : "Add your email above before saving."}
        </p>
      )}

      <button onClick={onSave} disabled={saving || !canSave} style={{ ...saveButtonStyle, opacity: saving || !canSave ? 0.6 : 1 }}>
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

const secondaryButtonStyle: React.CSSProperties = {
  background: "var(--surface)",
  color: "var(--green)",
  border: "1.5px solid var(--green)",
  borderRadius: 8,
  padding: "11px 16px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const backButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--muted)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  color: "#b3413a",
  fontSize: 13,
  marginTop: 8,
  marginBottom: 0,
};

const countryChipStyle: React.CSSProperties = {
  background: "var(--surface-alt)",
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "12px 14px",
  fontWeight: 700,
  fontSize: 14,
};
