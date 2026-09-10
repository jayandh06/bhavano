"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AccountMergeSummary } from "@bhavano/types";
import { checkNewSignupAction, linkPhoneAction, sendOtpAction, signOutAction } from "@/app/actions/auth";
import {
  confirmAccountMergeAction,
  fetchProfileNudgeAction,
  requestEmailCodeAction,
  snoozeProfileNudgeAction,
  verifyEmailAction,
} from "@/app/actions/users";
import { Icon } from "./Icon";

/**
 * Deferred profile-completion dialog — see docs/plans/profile-completion-dialog.md.
 *
 * Asks a single-identifier user (phone-only or Google-only) for the missing email/phone, but
 * only on a RETURN login (`!session.isNewUser`), once per browser session, and only after the
 * first navigation — never on the login-redirect frame and never during the first session. The
 * BFF (`GET /users/me/profile-nudge`) owns the snooze window + lifetime cap; this component adds
 * the "return login" and "one per session" gates. Skippable: closing it, or "Not now", snoozes
 * it a week. Nothing is blocked behind it.
 */

const SESSION_KEY = "bhavano_profile_nudge_seen";

type Step = "askPhone" | "askOtp" | "askEmail" | "askEmailCode" | "confirmMerge" | "done";

const inputClass =
  "w-full border-[1.5px] border-border rounded-lg px-3.5 py-3 text-sm bg-surface text-text outline-none focus:border-green";
const primaryClass =
  "w-full bg-green text-on-green border-0 rounded-lg p-[13px] text-sm font-bold cursor-pointer disabled:opacity-50";
const ghostClass = "w-full bg-transparent border-0 text-muted text-[13px] font-bold cursor-pointer mt-2 disabled:opacity-50";

export function ProfileCompletionDialog() {
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [want, setWant] = useState<"email" | "phone">("phone");
  const [step, setStep] = useState<Step>("askPhone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeSummary, setMergeSummary] = useState<AccountMergeSummary | null>(null);

  // Run the check once, on the first navigation after mount — a returning user gets a beat to do
  // what they came back for before anything pops. A ref guard (not effect setState) keeps this
  // clear of the set-state-in-effect rule; every setState below sits in an async callback.
  const initialPath = useRef(pathname);
  const checkedRef = useRef(false);
  useEffect(() => {
    if (checkedRef.current || pathname === initialPath.current) return;
    checkedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        if (sessionStorage.getItem(SESSION_KEY)) return;
      } catch {
        // Private mode / storage blocked — fall through; the BFF snooze is the backstop guard.
      }
      const [{ isNewUser }, nudge] = await Promise.all([checkNewSignupAction(), fetchProfileNudgeAction()]);
      if (cancelled || isNewUser || !nudge.show || nudge.missing.length === 0) return;
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
      const target = nudge.missing.includes("phone") ? "phone" : "email";
      setWant(target);
      setStep(target === "phone" ? "askPhone" : "askEmail");
      setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  function dismiss() {
    setOpen(false);
    void snoozeProfileNudgeAction();
  }

  function succeed(reauthRequired = false) {
    setStep("done");
    setOpen(false);
    if (reauthRequired) void signOutAction();
    else router.refresh();
  }

  function handleLinkResult(
    result: { status: "linked" } | { status: "merged"; reauthRequired: boolean } | { status: "confirm"; summary: AccountMergeSummary },
  ) {
    if (result.status === "confirm") {
      setMergeSummary(result.summary);
      setStep("confirmMerge");
      return;
    }
    succeed(result.status === "merged" && result.reauthRequired);
  }

  async function onSendOtp() {
    setPending(true);
    setError(null);
    const res = await sendOtpAction(phone.trim());
    setPending(false);
    if (res.success) setStep("askOtp");
    else setError(res.error ?? "Couldn't send the OTP");
  }

  async function onVerifyOtp() {
    setPending(true);
    setError(null);
    const res = await linkPhoneAction(phone.trim(), otp.trim());
    setPending(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    handleLinkResult(res.result);
  }

  async function onSendEmailCode() {
    setPending(true);
    setError(null);
    const res = await requestEmailCodeAction(email.trim());
    setPending(false);
    if (res.success) setStep("askEmailCode");
    else setError(res.error ?? "Couldn't send the code");
  }

  async function onVerifyEmailCode() {
    setPending(true);
    setError(null);
    const res = await verifyEmailAction(email.trim(), code.trim());
    setPending(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    handleLinkResult(res.result);
  }

  async function onConfirmMerge() {
    setPending(true);
    setError(null);
    const res = await confirmAccountMergeAction(
      want === "phone" ? { phone: phone.trim(), code: otp.trim() } : { email: email.trim(), code: code.trim() },
    );
    setPending(false);
    if (!res.success) {
      setError(res.error ?? "Couldn't merge the accounts");
      return;
    }
    // A merge can retire the current account; safest to re-authenticate.
    succeed(true);
  }

  if (!open) return null;

  const title =
    step === "confirmMerge"
      ? `That ${want} is already registered`
      : want === "phone"
        ? "Add your phone number"
        : "Add your email";

  return (
    <div
      onClick={dismiss}
      className="fixed inset-0 bg-[var(--modal-scrim)] z-[110] flex items-center justify-center p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-2xl w-[400px] max-w-full p-6 animate-[modalIn_0.2s_ease_both]"
      >
        <div className="flex justify-between items-start mb-1.5">
          <div className="font-lora font-bold text-[19px] text-text">{title}</div>
          <button onClick={dismiss} aria-label="Close" className="bg-transparent border-0 text-xl cursor-pointer text-muted">
            <Icon name="close" />
          </button>
        </div>

        {step !== "confirmMerge" && (
          <p className="text-[13px] text-muted mb-4 leading-[1.5]">
            {want === "phone"
              ? "So buyers can reach you about your listings, and we can text you when someone's interested."
              : "So we can email you a copy of your listings and updates about your account."}
          </p>
        )}

        {step === "askPhone" && (
          <>
            <input
              type="tel"
              inputMode="numeric"
              autoFocus
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
            {error && <p className="text-[#b3413a] text-[13px] mt-2 mb-0">{error}</p>}
            <button onClick={onSendOtp} disabled={pending || phone.trim().length < 10} className={`${primaryClass} mt-3`}>
              {pending ? "Sending…" : "Send OTP"}
            </button>
            <button onClick={dismiss} disabled={pending} className={ghostClass}>
              Not now
            </button>
          </>
        )}

        {step === "askOtp" && (
          <>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              placeholder="6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className={inputClass}
            />
            {error && <p className="text-[#b3413a] text-[13px] mt-2 mb-0">{error}</p>}
            <button onClick={onVerifyOtp} disabled={pending || otp.trim().length < 4} className={`${primaryClass} mt-3`}>
              {pending ? "Verifying…" : "Verify & add"}
            </button>
            <button onClick={() => setStep("askPhone")} disabled={pending} className={ghostClass}>
              Change number
            </button>
          </>
        )}

        {step === "askEmail" && (
          <>
            <input
              type="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
            {error && <p className="text-[#b3413a] text-[13px] mt-2 mb-0">{error}</p>}
            <button
              onClick={onSendEmailCode}
              disabled={pending || !email.includes("@")}
              className={`${primaryClass} mt-3`}
            >
              {pending ? "Sending…" : "Send code"}
            </button>
            <button onClick={dismiss} disabled={pending} className={ghostClass}>
              Not now
            </button>
          </>
        )}

        {step === "askEmailCode" && (
          <>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={inputClass}
            />
            {error && <p className="text-[#b3413a] text-[13px] mt-2 mb-0">{error}</p>}
            <button onClick={onVerifyEmailCode} disabled={pending || code.trim().length < 4} className={`${primaryClass} mt-3`}>
              {pending ? "Verifying…" : "Verify & add"}
            </button>
            <button onClick={() => setStep("askEmail")} disabled={pending} className={ghostClass}>
              Change email
            </button>
          </>
        )}

        {step === "confirmMerge" && mergeSummary && (
          <>
            <p className="text-[13px] text-text-soft mb-3 leading-[1.5]">
              It&apos;s on another account with{" "}
              {[
                mergeSummary.listings && `${mergeSummary.listings} listing${mergeSummary.listings === 1 ? "" : "s"}`,
                mergeSummary.conversations && `${mergeSummary.conversations} conversation${mergeSummary.conversations === 1 ? "" : "s"}`,
                mergeSummary.payments && `${mergeSummary.payments} payment${mergeSummary.payments === 1 ? "" : "s"}`,
                mergeSummary.favourites && `${mergeSummary.favourites} saved`,
                mergeSummary.activeSubscription && "an active plan",
              ]
                .filter(Boolean)
                .join(", ") || "some activity"}
              . Merging brings it all onto one account.
            </p>
            {error && <p className="text-[#b3413a] text-[13px] mt-2 mb-2">{error}</p>}
            <button onClick={onConfirmMerge} disabled={pending} className={primaryClass}>
              {pending ? "Merging…" : "Merge the accounts"}
            </button>
            <button
              onClick={() => {
                setError(null);
                setMergeSummary(null);
                setStep(want === "phone" ? "askPhone" : "askEmail");
              }}
              disabled={pending}
              className={ghostClass}
            >
              Use a different {want}
            </button>
            <button onClick={dismiss} disabled={pending} className={ghostClass}>
              Not now
            </button>
          </>
        )}
      </div>
    </div>
  );
}
