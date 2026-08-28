"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountMergeSummary, City, UserProfileDto } from "@bhavano/types";
import { autoDetectCityAction, searchCitiesAction } from "@/app/actions/locations";
import { LocationMapPicker } from "./LocationMapPicker";
import {
  confirmAccountMergeAction,
  deleteAccountAction,
  requestEmailCodeAction,
  updateProfileAction,
  verifyEmailAction,
} from "@/app/actions/users";
import { linkPhoneAction, sendOtpAction, signOutAction } from "@/app/actions/auth";

type PhoneStep = "idle" | "otpSent";

export function ProfileForm({ profile }: { profile: UserProfileDto }) {
  const [name, setName] = useState(profile.name ?? "");
  const [cityId, setCityId] = useState(profile.cityId ?? undefined);
  const [cityName, setCityName] = useState(profile.cityName ?? "");
  const [state, setState] = useState(profile.state ?? "");
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [showCityResults, setShowCityResults] = useState(false);
  const [cityNoResults, setCityNoResults] = useState(false);
  const [showCityMap, setShowCityMap] = useState(false);
  const [newCityNote, setNewCityNote] = useState<string | null>(null);
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
  const [mergePrompt, setMergePrompt] = useState<{
    summary: AccountMergeSummary;
    identifier: { phone?: string; email?: string; code: string };
    label: string;
  } | null>(null);
  const [mergeNotice, setMergeNotice] = useState<string | null>(null);
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteSent, setDeleteSent] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    if (!result.success) {
      setEmailError(result.error);
      return;
    }

    if (result.result.status === "confirm") {
      // Both accounts hold something, so nothing moves until the user agrees. The code stays
      // valid for the confirm call — the server deliberately did not consume it.
      setMergePrompt({
        summary: result.result.summary,
        identifier: { email: email.trim(), code: emailCode },
        label: "email",
      });
      return;
    }

    if (result.result.status === "merged") {
      finishMerge(result.result.reauthRequired);
      return;
    }

    setEmailVerified(true);
    setEmailStep("idle");
    setSavedEmail(email.trim());
    setEmailCode("");
  }

  function finishMerge(reauthRequired: boolean) {
    setEmailStep("idle");
    setEmailCode("");
    setPhoneStep("idle");
    setOtpInput("");
    setMergePrompt(null);
    if (reauthRequired) {
      // This session's own account was the one retired — its data now lives under the surviving
      // id, so continuing as it would show an empty profile. Sign out rather than leave them
      // looking at a hollow account.
      setMergeNotice("Your accounts are now combined. Please sign in again to continue.");
    } else {
      setMergeNotice("Your accounts are now combined.");
      router.refresh();
    }
  }

  async function handleConfirmMerge() {
    if (!mergePrompt) return;
    setEmailPending(true);
    setEmailError(null);
    const result = await confirmAccountMergeAction(mergePrompt.identifier);
    setEmailPending(false);
    if (result.success) finishMerge(false);
    else setEmailError(result.error ?? "Couldn't merge the accounts");
  }

  async function onCityQueryChange(value: string) {
    setCityQuery(value);
    setCityNoResults(false);
    if (!value) {
      setCityResults([]);
      setShowCityResults(false);
      return;
    }
    const results = await searchCitiesAction(value);
    setCityResults(results);
    setShowCityResults(results.length > 0);
    // Two characters in with nothing back is worth explaining — cities are a curated set, and
    // silence leaves the user unsure whether they mistyped or the city is unsupported.
    setCityNoResults(results.length === 0 && value.trim().length >= 2);
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

    if (!result.success) {
      setPhoneError(result.error);
      return;
    }

    if (result.result.status === "confirm") {
      // Another account holds this number and both have data, so nothing moves until the user
      // agrees. The OTP stays valid for the confirm call — the server left it unconsumed.
      setMergePrompt({
        summary: result.result.summary,
        identifier: { phone: phoneInput, code: otpInput },
        label: "phone number",
      });
      return;
    }

    if (result.result.status === "merged") {
      finishMerge(result.result.reauthRequired);
      return;
    }

    setCurrentPhone(phoneInput);
    setPhoneStep("idle");
    setOtpInput("");
  }

  /** Sends the confirmation code to whichever identifier the account holds — phone first, since
   * that is the one every account has. */
  async function sendDeleteCode() {
    setDeletePending(true);
    setDeleteError(null);
    const result = currentPhone
      ? await sendOtpAction(currentPhone)
      : await requestEmailCodeAction(savedEmail ?? "");
    setDeletePending(false);
    if (result.success) setDeleteSent(true);
    else setDeleteError(result.error ?? "Couldn't send the code");
  }

  async function confirmDelete() {
    setDeletePending(true);
    setDeleteError(null);
    const result = await deleteAccountAction(
      currentPhone
        ? { phone: currentPhone, code: deleteCode }
        : { email: savedEmail ?? "", code: deleteCode },
    );
    setDeletePending(false);
    if (!result.success) {
      setDeleteError(result.error ?? "Couldn't delete the account");
      return;
    }
    // The session now points at an account with nothing behind it, so end it rather than leave
    // them looking at an empty profile.
    await signOutAction();
    router.push("/");
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
        {mergeNotice && (
          <p aria-live="polite" className="text-green text-[13px] font-bold m-0 mt-2">
            {mergeNotice}
          </p>
        )}

        {/* Both accounts hold something, so nothing has moved yet. Itemised rather than a bare
            confirm: the user is agreeing to relocate real data, and a merge cannot be undone by
            them — only by support, from the retired row. */}
        {mergePrompt && (
          <div className="border border-border rounded-lg p-4 mt-3">
            <p className="m-0 font-bold text-text">
              That {mergePrompt.label} is on another Bhavano account.
            </p>
            <p className="m-0 mt-2 text-[13px] text-text-soft">
              You&apos;ve verified both, so we can combine them. That account has:
            </p>
            <ul className="list-disc m-0 mt-2 mb-3 pl-5 text-[13px] text-text-soft">
              {mergePrompt.summary.listings > 0 && <li>{mergePrompt.summary.listings} listing(s)</li>}
              {mergePrompt.summary.activeSubscription && <li>an active subscription</li>}
              {mergePrompt.summary.conversations > 0 && (
                <li>{mergePrompt.summary.conversations} conversation(s)</li>
              )}
              {mergePrompt.summary.payments > 0 && <li>{mergePrompt.summary.payments} payment(s)</li>}
              {mergePrompt.summary.favourites > 0 && (
                <li>{mergePrompt.summary.favourites} saved favourite(s)</li>
              )}
            </ul>
            <p className="m-0 mb-3 text-[12.5px] text-muted">
              Everything moves into one account. This can&apos;t be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmMerge}
                disabled={emailPending}
                className="bg-green text-white border-0 rounded-lg px-4 py-2 text-[13px] font-bold cursor-pointer disabled:opacity-60"
              >
                {emailPending ? "Combining…" : "Combine accounts"}
              </button>
              <button
                type="button"
                onClick={() => setMergePrompt(null)}
                className="bg-transparent border-[1.5px] border-border text-text rounded-lg px-4 py-2 text-[13px] font-bold cursor-pointer"
              >
                Keep separate
              </button>
            </div>
          </div>
        )}

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
          onFocus={() => {
            // Clear the resolved "City, State" text so editing starts a fresh search. Without
            // this, backspacing one character searched for "Bengaluru, Karnatak" — comma, state
            // fragment and all — which matches nothing, and the field looked stuck.
            if (cityName) {
              setCityQuery("");
              setCityResults([]);
              setCityNoResults(false);
            }
            if (cityResults.length > 0) setShowCityResults(true);
          }}
          placeholder="Search for your city"
          className={inputClass}
        />
        {cityNoResults && !showCityMap && (
          <p className="text-[12.5px] text-muted m-0 mt-1.5">
            No match yet.{" "}
            <button
              type="button"
              onClick={() => setShowCityMap(true)}
              className="bg-transparent border-0 p-0 text-green font-bold cursor-pointer underline"
            >
              Find it on the map
            </button>{" "}
            and we&apos;ll add it.
          </p>
        )}

        {/* Reuses the posting flow's picker rather than sending the user there: dropping a pin
            reverse-geocodes through the same path, which creates the city when Bhavano does not
            already cover it (LocationsService.ensureCity). Without this the profile was a dead
            end for anyone outside the seeded set. */}
        {showCityMap && (
          <div className="mt-2">
            <LocationMapPicker
              defaultCenter={{ lat: 20.5937, lng: 78.9629 }}
              onPinChange={(_pin, suggestion) => {
                if (!suggestion?.cityId) return;
                setCityId(suggestion.cityId);
                setCityName(suggestion.cityName ?? "");
                // The DTO carries no state — the display template already omits the ", State"
                // half when it is blank.
                setState("");
                setCityQuery("");
                setCityNoResults(false);
                setShowCityMap(false);
                setNewCityNote(
                  suggestion.isNewCity
                    ? `Added ${suggestion.cityName} — select Save to use it.`
                    : null,
                );
              }}
            />
            <button
              type="button"
              onClick={() => setShowCityMap(false)}
              className="bg-transparent border-0 p-0 mt-2 text-[12.5px] text-muted cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {newCityNote && <p className="text-[12.5px] text-green font-bold m-0 mt-1.5">{newCityNote}</p>}
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

      {/* App Store guideline 5.1.1(v) requires deletion to be startable in-app, and the DPDP Act
          requires it regardless of the store. Gated behind a freshly-issued code because it is
          irreversible — a borrowed unlocked phone should not be enough. */}
      <div className="border-t border-border pt-5 mt-2">
        {!deleteOpen ? (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="bg-transparent border-0 p-0 text-[13px] text-[#b3413a] font-bold cursor-pointer"
          >
            Delete my account
          </button>
        ) : (
          <div>
            <p className="m-0 mb-2 text-[13px] font-bold text-text">Delete your account?</p>
            <p className="m-0 mb-3 text-[12.5px] text-muted">
              Your ads come offline, your saved searches are removed, and your name, email and
              phone number are erased. Records of payments you made are kept for accounting, but
              no longer identify you. This can&apos;t be undone.
            </p>
            {!deleteSent ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={sendDeleteCode}
                  disabled={deletePending}
                  className="bg-[#b3413a] text-white border-0 rounded-lg px-4 py-2 text-[13px] font-bold cursor-pointer disabled:opacity-60"
                >
                  {deletePending ? "Sending…" : `Send confirmation code to ${currentPhone ? "my phone" : "my email"}`}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteOpen(false)}
                  className="bg-transparent border-[1.5px] border-border text-text rounded-lg px-4 py-2 text-[13px] font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={deleteCode}
                  onChange={(e) => setDeleteCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit code"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deletePending || deleteCode.length !== 6}
                  className="bg-[#b3413a] text-white border-0 rounded-lg px-4 py-2 text-[13px] font-bold cursor-pointer disabled:opacity-60 whitespace-nowrap"
                >
                  {deletePending ? "Deleting…" : "Delete permanently"}
                </button>
              </div>
            )}
            {deleteError && <p className={errorClass}>{deleteError}</p>}
          </div>
        )}
      </div>

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
