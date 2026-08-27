"use client";

import { useEffect, useState } from "react";
import type { City, UserProfileDto } from "@bhavano/types";
import { autoDetectCityAction, searchCitiesAction } from "@/app/actions/locations";
import { requestEmailCodeAction, updateProfileAction, verifyEmailAction } from "@/app/actions/users";
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
  const [savedEmail, setSavedEmail] = useState(profile.email);
  const [emailVerified, setEmailVerified] = useState(profile.emailVerified);
  const [emailStep, setEmailStep] = useState<"idle" | "codeSent">("idle");
  const [emailCode, setEmailCode] = useState("");
  const [emailPending, setEmailPending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [currentPhone, setCurrentPhone] = useState(profile.phone);
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("idle");
  const [phoneInput, setPhoneInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [phonePending, setPhonePending] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const emailMissing = !savedEmail;
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

  async function handleSendEmailCode() {
    setEmailPending(true);
    setEmailError(null);
    const result = await requestEmailCodeAction(email.trim());
    setEmailPending(false);
    if (result.success) setEmailStep("codeSent");
    else setEmailError(result.error ?? "Couldn't send the code");
  }

  async function handleVerifyEmail() {
    setEmailPending(true);
    setEmailError(null);
    const result = await verifyEmailAction(email.trim(), emailCode);
    setEmailPending(false);
    if (result.success) {
      setEmailVerified(true);
      setEmailStep("idle");
      setEmailCode("");
      // The address is only stored at this point, so the read-only view has to learn about it
      // without waiting for a reload.
      if (result.profile?.email) setSavedEmail(result.profile.email);
    } else {
      setEmailError(result.error ?? "Couldn't verify the code");
    }
  }

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
    });
    setSaving(false);
    setDetected(false);
    setMessage(
      result.success ? { type: "success", text: "Profile updated." } : { type: "error", text: result.error ?? "Failed to update profile" },
    );
  }

  return (
    <div className="max-w-[480px] flex flex-col gap-5">
      <div>
        <label className={labelClass}>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>
          Email {!savedEmail && <span className="text-[#b3413a]">*</span>}
        </label>
        {savedEmail ? (
          <>
            <div className={readOnlyClass}>
              {savedEmail}
              {emailVerified ? (
                <span className="text-green font-bold ml-2">✓ Verified</span>
              ) : (
                <span className="text-muted ml-2">Not verified</span>
              )}
            </div>
            {/* An unverified address still reaches the user, but it is not proof of who they
                are — Google sign-in only merges into this account once it is verified, so
                without this step a phone-first user keeps ending up with two accounts. */}
            {!emailVerified && (
              <div className="mt-2">
                {emailStep === "idle" ? (
                  <>
                    <p className="text-[12.5px] text-muted m-0 mb-2">
                      Verify this address so signing in with Google brings you back to this same
                      account.
                    </p>
                    <button
                      type="button"
                      onClick={handleSendEmailCode}
                      disabled={emailPending}
                      className="border-[1.5px] border-green text-green bg-transparent rounded-lg px-4 py-2 text-[13px] font-bold cursor-pointer disabled:opacity-60"
                    >
                      {emailPending ? "Sending…" : "Send verification code"}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[12.5px] text-muted m-0 mb-2">
                      We sent a 6-digit code to {savedEmail}. It expires in 10 minutes.
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={emailCode}
                        onChange={(e) => setEmailCode(e.target.value)}
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="6-digit code"
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={handleVerifyEmail}
                        disabled={emailPending || emailCode.length !== 6}
                        className="bg-green text-white border-0 rounded-lg px-4 py-2 text-[13px] font-bold cursor-pointer disabled:opacity-60 whitespace-nowrap"
                      >
                        {emailPending ? "Verifying…" : "Verify"}
                      </button>
                    </div>
                  </>
                )}
                {emailError && <p className={errorClass}>{emailError}</p>}
              </div>
            )}
          </>
        ) : (
          <>
            {/* An email can only enter the profile verified — the same rule the phone field has
                always had. Saving an unverified address is what let one person end up with two
                accounts, and worse, would have let someone claim an address that wasn't theirs. */}
            <p className="text-[12.5px] text-muted m-0 mb-2">
              You signed in with your phone number — add an email so we have another way to reach
              you. We&apos;ll send a code to confirm it&apos;s yours.
            </p>
            {emailStep === "idle" ? (
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={handleSendEmailCode}
                  disabled={emailPending || !email.includes("@")}
                  className="bg-green text-white border-0 rounded-lg px-4 py-2 text-[13px] font-bold cursor-pointer disabled:opacity-60 whitespace-nowrap"
                >
                  {emailPending ? "Sending…" : "Send code"}
                </button>
              </div>
            ) : (
              <>
                <p className="text-[12.5px] text-muted m-0 mb-2">
                  We sent a 6-digit code to {email}. It expires in 10 minutes.
                </p>
                <div className="flex gap-2">
                  <input
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value)}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6-digit code"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyEmail}
                    disabled={emailPending || emailCode.length !== 6}
                    className="bg-green text-white border-0 rounded-lg px-4 py-2 text-[13px] font-bold cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    {emailPending ? "Verifying…" : "Verify"}
                  </button>
                </div>
              </>
            )}
            {emailError && <p className={errorClass}>{emailError}</p>}
          </>
        )}
      </div>

      <div>
        <label className={labelClass}>
          Phone {!currentPhone && <span className="text-[#b3413a]">*</span>}
        </label>
        {currentPhone ? (
          <div className={readOnlyClass}>{currentPhone}</div>
        ) : (
          <>
            <p className="text-[12.5px] text-muted m-0 mb-2">
              You signed in with Google — add and verify a phone number so buyers/sellers can reach you.
            </p>
            {phoneStep === "idle" ? (
              <>
                <div className="flex gap-2">
                  <div className={countryChipClass}>+91</div>
                  <input
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="10-digit mobile number"
                    className={inputClass}
                  />
                </div>
                {phoneError && <p className={errorClass}>{phoneError}</p>}
                <button
                  onClick={onSendPhoneOtp}
                  disabled={phoneInput.length !== 10 || phonePending}
                  className={`${secondaryButtonClass} mt-2.5 ${phoneInput.length === 10 ? "opacity-100" : "opacity-50"}`}
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
                  className={`${inputClass} text-center tracking-[0.4em]`}
                />
                {phoneError && <p className={errorClass}>{phoneError}</p>}
                <div className="flex gap-2.5 mt-2.5">
                  <button
                    onClick={onVerifyPhoneOtp}
                    disabled={otpInput.length !== 6 || phonePending}
                    className={`${secondaryButtonClass} ${otpInput.length === 6 ? "opacity-100" : "opacity-50"}`}
                  >
                    {phonePending ? "Verifying…" : "Verify & link"}
                  </button>
                  <button
                    onClick={() => {
                      setPhoneStep("idle");
                      setPhoneError(null);
                    }}
                    className={backButtonClass}
                  >
                    ← Back
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="relative">
        <label className={labelClass}>City</label>
        {detected && (
          <p className="text-[12.5px] text-muted m-0 mb-2">
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
          className={inputClass}
        />
        {showCityResults && cityResults.length > 0 && (
          <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-surface border border-border rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-20 max-h-[220px] overflow-y-auto">
            {cityResults.map((city) => (
              <button
                key={city.id}
                onClick={() => selectCity(city)}
                className="block w-full text-left bg-transparent border-0 px-3.5 py-2.5 text-sm text-text cursor-pointer"
              >
                {city.name}, {city.state}
              </button>
            ))}
          </div>
        )}
      </div>

      {message && (
        <p className={`text-[13px] m-0 ${message.type === "success" ? "text-green" : "text-[#b3413a]"}`}>{message.text}</p>
      )}

      {!canSave && (
        <p className="text-[12.5px] text-muted m-0">
          {!currentPhone && emailMissing
            ? "Add your email above and verify your phone number above before saving."
            : !currentPhone
              ? "Verify your phone number above before saving."
              : "Add your email above before saving."}
        </p>
      )}

      <button
        onClick={onSave}
        disabled={saving || !canSave}
        className={`${saveButtonClass} ${saving || !canSave ? "opacity-60" : "opacity-100"}`}
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

const labelClass = "block text-xs font-bold text-muted mb-1.5 uppercase tracking-[0.02em]";

const inputClass = "w-full border border-border rounded-[9px] px-3.5 py-3 text-sm outline-none bg-surface text-text";

const readOnlyClass = "w-full border border-border rounded-[9px] px-3.5 py-3 text-sm bg-surface-alt text-text-soft";

const saveButtonClass = "bg-green text-on-green border-0 rounded-lg p-[13px] text-sm font-bold cursor-pointer";

const secondaryButtonClass = "bg-surface text-green border-[1.5px] border-green rounded-lg px-4 py-[11px] text-sm font-bold cursor-pointer";

const backButtonClass = "bg-transparent border-0 text-muted text-[13px] font-bold cursor-pointer";

const errorClass = "text-[#b3413a] text-[13px] mt-2 mb-0";

const countryChipClass = "bg-surface-alt border border-border rounded-[9px] px-3.5 py-3 font-bold text-sm";
