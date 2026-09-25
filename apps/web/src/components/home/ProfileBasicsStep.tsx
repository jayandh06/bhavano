"use client";

import { useEffect, useState } from "react";
import type { AccountMergeSummary, City, LinkIdentifierResult } from "@bhavano/types";
import { linkPhoneAction, sendOtpAction } from "@/app/actions/auth";
import { searchCitiesAction } from "@/app/actions/locations";
import {
  confirmAccountMergeAction,
  requestEmailCodeAction,
  updateProfileAction,
  verifyEmailAction,
} from "@/app/actions/users";
import { Icon } from "./Icon";

const MIN_CITY_QUERY = 2;

export type SecondaryNeed = "phone" | "email" | null;

export interface ProfileBasicsValues {
  name: string;
  cityId: string | null;
  cityName: string | null;
  phone: string | null;
  email: string | null;
  emailVerified: boolean;
  /** Missing secondary channel that must be verified before leaving the sheet. */
  needSecondary: SecondaryNeed;
}

/** Gate helper — open basics when name, verified secondary, or city is missing. */
export function profileNeedsBasics(profile: {
  name: string | null;
  phone?: string | null;
  email?: string | null;
  emailVerified: boolean;
  cityId: string | null;
}): boolean {
  return (
    !profile.name?.trim() ||
    secondaryNeedFromProfile(profile) !== null ||
    !profile.cityId
  );
}

export function secondaryNeedFromProfile(profile: {
  phone?: string | null;
  email?: string | null;
  emailVerified: boolean;
}): SecondaryNeed {
  if (!profile.phone) return "phone";
  if (!profile.email || !profile.emailVerified) return "email";
  return null;
}

export function basicsFromProfile(profile: {
  name: string | null;
  phone?: string | null;
  email?: string | null;
  emailVerified: boolean;
  cityId: string | null;
  cityName: string | null;
}): ProfileBasicsValues {
  return {
    name: profile.name?.trim() ?? "",
    cityId: profile.cityId,
    cityName: profile.cityName,
    phone: profile.phone ?? null,
    email: profile.email ?? null,
    emailVerified: profile.emailVerified,
    needSecondary: secondaryNeedFromProfile(profile),
  };
}

/** Dismiss / Skip only when name + secondary were already satisfied (city-only gap). */
export function canDismissBasics(initial: ProfileBasicsValues): boolean {
  return initial.name.trim().length > 0 && initial.needSecondary === null;
}

type Phase =
  | "details"
  | "askPhone"
  | "askOtp"
  | "askEmail"
  | "askEmailCode"
  | "confirmMerge";

/**
 * Post-login name + mandatory verified secondary + optional city —
 * see docs/plans/post-login-name-and-city.md.
 */
export function ProfileBasicsStep({
  initial,
  pending,
  error,
  onError,
  onPending,
  onSaved,
  onSkip,
  onReauthRequired,
}: {
  initial: ProfileBasicsValues;
  pending: boolean;
  error: string | null;
  onError: (message: string | null) => void;
  onPending: (pending: boolean) => void;
  onSaved: (saved: ProfileBasicsValues) => void;
  /** Only when name + secondary already present (city-only). */
  onSkip: () => void;
  /** Merge retired this session — sign out so the user re-authenticates. */
  onReauthRequired: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [cityId, setCityId] = useState<string | null>(initial.cityId);
  const [cityName, setCityName] = useState<string | null>(initial.cityName);
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [showCityResults, setShowCityResults] = useState(false);
  const [cityNoResults, setCityNoResults] = useState(false);

  const [phase, setPhase] = useState<Phase>("details");
  const [secondaryDone, setSecondaryDone] = useState(initial.needSecondary === null);
  const [linkPhone, setLinkPhone] = useState("");
  const [linkOtp, setLinkOtp] = useState("");
  const [linkEmail, setLinkEmail] = useState("");
  const [linkCode, setLinkCode] = useState("");
  const [mergeSummary, setMergeSummary] = useState<AccountMergeSummary | null>(null);

  const nameOk = name.trim().length > 0;
  const showSkip = canDismissBasics(initial);

  useEffect(() => {
    setName(initial.name);
    setCityId(initial.cityId);
    setCityName(initial.cityName);
    setSecondaryDone(initial.needSecondary === null);
    setPhase("details");
  }, [initial]);

  async function onCityQueryChange(value: string) {
    setCityQuery(value);
    setCityNoResults(false);
    if (value.trim().length < MIN_CITY_QUERY) {
      setCityResults([]);
      setShowCityResults(false);
      return;
    }
    const results = await searchCitiesAction(value.trim());
    setCityResults(results);
    setShowCityResults(results.length > 0);
    setCityNoResults(results.length === 0);
  }

  function selectCity(city: City) {
    setCityId(city.id);
    setCityName(city.name);
    setCityQuery("");
    setShowCityResults(false);
    setCityNoResults(false);
  }

  function clearCity() {
    setCityId(null);
    setCityName(null);
    setCityQuery("");
    setShowCityResults(false);
  }

  async function saveNameAndCity(): Promise<boolean> {
    const result = await updateProfileAction({
      name: name.trim(),
      ...(cityId ? { cityId } : {}),
    });
    if (!result.success) {
      onError(result.error ?? "Couldn't save");
      return false;
    }
    return true;
  }

  async function finish() {
    onPending(true);
    onError(null);
    const ok = await saveNameAndCity();
    onPending(false);
    if (!ok) return;
    onSaved({
      ...initial,
      name: name.trim(),
      cityId,
      cityName,
      needSecondary: null,
      phone: secondaryDone && initial.needSecondary === "phone" ? linkPhone || initial.phone : initial.phone,
      email: secondaryDone && initial.needSecondary === "email" ? linkEmail || initial.email : initial.email,
      emailVerified: secondaryDone && initial.needSecondary === "email" ? true : initial.emailVerified,
    });
  }

  async function onContinueDetails() {
    if (!nameOk) {
      onError("Please enter your name");
      return;
    }
    onPending(true);
    onError(null);
    const ok = await saveNameAndCity();
    onPending(false);
    if (!ok) return;

    if (!secondaryDone && initial.needSecondary === "phone") {
      setPhase("askPhone");
      return;
    }
    if (!secondaryDone && initial.needSecondary === "email") {
      setPhase("askEmail");
      return;
    }
    await finish();
  }

  function handleLinkResult(result: LinkIdentifierResult) {
    if (result.status === "confirm") {
      setMergeSummary(result.summary);
      setPhase("confirmMerge");
      return;
    }
    if (result.status === "merged" && result.reauthRequired) {
      onReauthRequired();
      return;
    }
    setSecondaryDone(true);
    setPhase("details");
    void finish();
  }

  async function onSendLinkOtp() {
    onPending(true);
    onError(null);
    const res = await sendOtpAction(linkPhone.trim());
    onPending(false);
    if (res.success) setPhase("askOtp");
    else onError(res.error ?? "Couldn't send the OTP");
  }

  async function onVerifyLinkOtp() {
    onPending(true);
    onError(null);
    const res = await linkPhoneAction(linkPhone.trim(), linkOtp.trim());
    onPending(false);
    if (!res.success) {
      onError(res.error);
      return;
    }
    handleLinkResult(res.result);
  }

  async function onSendEmailCode() {
    onPending(true);
    onError(null);
    const res = await requestEmailCodeAction(linkEmail.trim());
    onPending(false);
    if (res.success) setPhase("askEmailCode");
    else onError(res.error ?? "Couldn't send the code");
  }

  async function onVerifyEmailCode() {
    onPending(true);
    onError(null);
    const res = await verifyEmailAction(linkEmail.trim(), linkCode.trim());
    onPending(false);
    if (!res.success) {
      onError(res.error);
      return;
    }
    handleLinkResult(res.result);
  }

  async function onConfirmMerge() {
    onPending(true);
    onError(null);
    const res = await confirmAccountMergeAction(
      initial.needSecondary === "phone"
        ? { phone: linkPhone.trim(), code: linkOtp.trim() }
        : { email: linkEmail.trim(), code: linkCode.trim() },
    );
    onPending(false);
    if (!res.success) {
      onError(res.error ?? "Couldn't merge the accounts");
      return;
    }
    onReauthRequired();
  }

  if (phase === "confirmMerge" && mergeSummary) {
    const want = initial.needSecondary === "phone" ? "phone" : "email";
    return (
      <div>
        <p className="text-[13px] text-text-soft mb-3 leading-[1.5]">
          That {want} is already on another account with{" "}
          {[
            mergeSummary.listings && `${mergeSummary.listings} listing${mergeSummary.listings === 1 ? "" : "s"}`,
            mergeSummary.conversations &&
              `${mergeSummary.conversations} conversation${mergeSummary.conversations === 1 ? "" : "s"}`,
            mergeSummary.payments && `${mergeSummary.payments} payment${mergeSummary.payments === 1 ? "" : "s"}`,
            mergeSummary.favourites && `${mergeSummary.favourites} saved`,
            mergeSummary.activeSubscription && "an active plan",
          ]
            .filter(Boolean)
            .join(", ") || "some activity"}
          . Merging brings it all onto one account.
        </p>
        {error && <p className="text-[#b3413a] text-[13px] mt-2 mb-2">{error}</p>}
        <button type="button" onClick={() => void onConfirmMerge()} disabled={pending} className={primaryButtonClass}>
          {pending ? "Merging…" : "Merge the accounts"}
        </button>
        <button
          type="button"
          onClick={() => {
            onError(null);
            setMergeSummary(null);
            setPhase(want === "phone" ? "askPhone" : "askEmail");
          }}
          disabled={pending}
          className={backButtonClass}
        >
          Use a different {want}
        </button>
      </div>
    );
  }

  if (phase === "askPhone") {
    return (
      <div>
        <p className="text-[13px] text-muted m-0 mb-4">
          Add a phone number and verify it with OTP so buyers can reach you and you can sign in by
          phone later.
        </p>
        <div className="flex gap-2 mb-3.5">
          <div className="bg-surface-alt border border-border rounded-[9px] px-3.5 py-3 font-bold text-sm">+91</div>
          <input
            type="tel"
            inputMode="numeric"
            autoFocus
            value={linkPhone}
            onChange={(e) => setLinkPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="10-digit mobile number"
            className={inputClass}
          />
        </div>
        {error && <p className="text-[#b3413a] text-[13px] mt-2 mb-0">{error}</p>}
        <button
          type="button"
          onClick={() => void onSendLinkOtp()}
          disabled={pending || linkPhone.length !== 10}
          className={`${primaryButtonClass} mt-3 ${linkPhone.length === 10 ? "opacity-100" : "opacity-50"}`}
        >
          {pending ? "Sending…" : "Send OTP"}
        </button>
        <button type="button" onClick={() => setPhase("details")} disabled={pending} className={backButtonClass}>
          ← Back
        </button>
      </div>
    );
  }

  if (phase === "askOtp") {
    return (
      <div>
        <p className="text-[13px] text-muted m-0 mb-4">Enter the OTP sent to +91 {linkPhone}.</p>
        <input
          type="text"
          inputMode="numeric"
          autoFocus
          value={linkOtp}
          onChange={(e) => setLinkOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="······"
          className={`${inputClass} text-center tracking-[0.4em] mb-3.5`}
        />
        {error && <p className="text-[#b3413a] text-[13px] mt-2 mb-0">{error}</p>}
        <button
          type="button"
          onClick={() => void onVerifyLinkOtp()}
          disabled={pending || linkOtp.length !== 6}
          className={`${primaryButtonClass} ${linkOtp.length === 6 ? "opacity-100" : "opacity-50"}`}
        >
          {pending ? "Verifying…" : "Verify phone"}
        </button>
        <button type="button" onClick={() => setPhase("askPhone")} disabled={pending} className={backButtonClass}>
          Change number
        </button>
      </div>
    );
  }

  if (phase === "askEmail") {
    return (
      <div>
        <p className="text-[13px] text-muted m-0 mb-4">
          Add an email and verify it with a code so we can reach you about your ads — and so Google
          sign-in later returns you to this account.
        </p>
        <input
          type="email"
          autoFocus
          value={linkEmail}
          onChange={(e) => setLinkEmail(e.target.value)}
          placeholder="you@example.com"
          className={inputClass}
        />
        {error && <p className="text-[#b3413a] text-[13px] mt-2 mb-0">{error}</p>}
        <button
          type="button"
          onClick={() => void onSendEmailCode()}
          disabled={pending || !linkEmail.includes("@")}
          className={`${primaryButtonClass} mt-3 ${linkEmail.includes("@") ? "opacity-100" : "opacity-50"}`}
        >
          {pending ? "Sending…" : "Send code"}
        </button>
        <button type="button" onClick={() => setPhase("details")} disabled={pending} className={backButtonClass}>
          ← Back
        </button>
      </div>
    );
  }

  if (phase === "askEmailCode") {
    return (
      <div>
        <p className="text-[13px] text-muted m-0 mb-4">We sent a 6-digit code to {linkEmail}.</p>
        <input
          type="text"
          inputMode="numeric"
          autoFocus
          value={linkCode}
          onChange={(e) => setLinkCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="······"
          className={`${inputClass} text-center tracking-[0.4em] mb-3.5`}
        />
        {error && <p className="text-[#b3413a] text-[13px] mt-2 mb-0">{error}</p>}
        <button
          type="button"
          onClick={() => void onVerifyEmailCode()}
          disabled={pending || linkCode.length !== 6}
          className={`${primaryButtonClass} ${linkCode.length === 6 ? "opacity-100" : "opacity-50"}`}
        >
          {pending ? "Verifying…" : "Verify email"}
        </button>
        <button type="button" onClick={() => setPhase("askEmail")} disabled={pending} className={backButtonClass}>
          Change email
        </button>
      </div>
    );
  }

  // details phase
  const continueLabel = !secondaryDone
    ? initial.needSecondary === "phone"
      ? "Continue to verify phone"
      : "Continue to verify email"
    : "Continue";

  return (
    <div>
      <p className="text-[13px] text-muted m-0 mb-4">
        Sellers and buyers see your name in messages.
        {!secondaryDone && initial.needSecondary === "phone" && " You'll verify a phone number next."}
        {!secondaryDone && initial.needSecondary === "email" && " You'll verify an email next."}
        {" "}
        Preferred city personalises what you browse — you can skip it for now.
      </p>

      <label className="block text-[11.5px] font-bold text-muted mb-1.5">Name</label>
      <input
        autoFocus={!initial.name.trim()}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className={inputClass}
        maxLength={80}
      />

      <label className="block text-[11.5px] font-bold text-muted mb-1.5 mt-3.5">
        Preferred city <span className="font-normal">(optional)</span>
      </label>
      {cityName && !cityQuery ? (
        <div className="flex items-center gap-2 border border-border rounded-[9px] px-3.5 py-3 mb-1">
          <span className="flex-1 text-base sm:text-sm text-text font-bold">{cityName}</span>
          <button type="button" onClick={clearCity} className="bg-transparent border-0 text-muted cursor-pointer text-sm">
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            value={cityQuery}
            onChange={(e) => void onCityQueryChange(e.target.value)}
            placeholder="Start typing your city…"
            className={inputClass}
            autoComplete="off"
          />
          {showCityResults && (
            <ul className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-auto bg-surface border border-border rounded-[9px] shadow-md m-0 p-0 list-none">
              {cityResults.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => selectCity(c)}
                    className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-surface-alt border-0 bg-transparent cursor-pointer text-text"
                  >
                    {c.name}
                    <span className="text-muted text-[12px]"> · {c.state}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {cityNoResults && (
            <p className="text-[12px] text-muted m-0 mt-1.5">No cities match — try another spelling.</p>
          )}
          {cityQuery.trim().length > 0 && cityQuery.trim().length < MIN_CITY_QUERY && (
            <p className="text-[12px] text-muted m-0 mt-1.5">Type at least {MIN_CITY_QUERY} characters to search.</p>
          )}
        </div>
      )}

      {error && <p className="text-[#b3413a] text-[13px] mt-3 mb-0">{error}</p>}

      <button
        type="button"
        onClick={() => void onContinueDetails()}
        disabled={pending || !nameOk}
        className={`${primaryButtonClass} mt-4 ${nameOk ? "opacity-100" : "opacity-50"}`}
      >
        {pending ? "Saving…" : continueLabel}
      </button>

      {showSkip && (
        <button type="button" onClick={onSkip} disabled={pending} className={backButtonClass}>
          Skip city for now
        </button>
      )}
    </div>
  );
}

/** Close control for the auth modal on the basics step — blocked until name + secondary are set. */
export function ProfileBasicsCloseButton({
  canDismiss,
  onClose,
}: {
  canDismiss: boolean;
  onClose: () => void;
}) {
  if (!canDismiss) return null;
  return (
    <button onClick={onClose} className="bg-transparent border-0 text-xl cursor-pointer text-muted">
      <Icon name="close" />
    </button>
  );
}

const primaryButtonClass =
  "w-full bg-green text-on-green border-0 rounded-lg p-[13px] text-sm font-bold cursor-pointer mb-2.5";

const inputClass =
  "flex-1 w-full border border-border rounded-[9px] px-3.5 py-3 text-base sm:text-sm outline-none bg-surface text-text box-border";

const backButtonClass = "w-full bg-transparent border-0 text-muted text-[13px] font-bold cursor-pointer mt-1";
