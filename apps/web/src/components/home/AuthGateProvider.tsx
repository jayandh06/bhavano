"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendOtpAction, signInWithGoogleAction, verifyOtpAction } from "@/app/actions/auth";
import { requestEmailCodeAction, verifyEmailAction } from "@/app/actions/users";
import { pushDataLayerEvent } from "@/lib/gtm";

/** `email` and `emailCode` only ever follow a brand-new phone signup — see handleVerifyOtp. */
type LoginStep = "choose" | "phone" | "otp" | "email" | "emailCode";

interface AuthGateContextValue {
  /** `redirectTo` sends the user back to a specific path once logged in, instead of wherever the
   * login flow would otherwise leave them. Pass it when the page they are on only exists to be
   * used logged in — /post — so finishing the login continues what they came to do. Omit it for
   * the header's Login button, which is not tied to any particular intent. */
  requireLogin: (options?: { redirectTo?: string }) => void;
}

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

export function useAuthGate(): AuthGateContextValue {
  const ctx = useContext(AuthGateContext);
  if (!ctx) throw new Error("useAuthGate must be used within AuthGateProvider");
  return ctx;
}

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginStep, setLoginStep] = useState<LoginStep>("choose");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [redirectTo, setRedirectTo] = useState<string | undefined>(undefined);

  const router = useRouter();

  function requireLogin(options?: { redirectTo?: string }) {
    setRedirectTo(options?.redirectTo);
    setLoginStep("choose");
    setPhone("");
    setOtp("");
    setEmail("");
    setEmailCode("");
    setError(null);
    setShowLoginModal(true);
  }

  function closeModal() {
    setShowLoginModal(false);
  }

  function onLoginSuccess() {
    setShowLoginModal(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2200);
    // The header's logged-in state is a server-resolved `userName` prop (see Header ->
    // HeaderAuthButtons), so signing in server-side is not enough on its own: without this the
    // client keeps the RSC payload it rendered while logged out and the header still says
    // "Login" until the next navigation. Google sign-in avoids this only because it is a
    // full-page redirect.
    // A caller that named a destination gets sent there; everyone else stays put. The refresh
    // is needed either way — the header's logged-in state is a server-rendered prop, so without
    // it the client keeps the RSC payload it rendered while logged out.
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  async function handleSendOtp() {
    setPending(true);
    setError(null);
    const result = await sendOtpAction(phone);
    setPending(false);
    if (result.success) {
      setLoginStep("otp");
    } else {
      setError(result.error ?? "Failed to send OTP");
    }
  }

  async function handleVerifyOtp() {
    setPending(true);
    setError(null);
    const result = await verifyOtpAction(phone, otp);
    setPending(false);
    if (!result.success) {
      setError(result.error ?? "Incorrect OTP");
      return;
    }

    if (result.isNewUser) {
      pushDataLayerEvent("signup_complete", { method: "phone" });
      // Asked here, while they are already in a form, rather than by a banner they will ignore.
      // A verified email is what lets a later Google sign-in land in THIS account instead of
      // silently creating a second one — see docs/plans/account-linking-phone-and-email.md.
      // Skippable on purpose: someone who signed in to message a seller should not be trapped.
      setError(null);
      setLoginStep("email");
      return;
    }

    onLoginSuccess();
  }

  async function handleSendEmailCode() {
    setPending(true);
    setError(null);
    const result = await requestEmailCodeAction(email.trim());
    setPending(false);
    if (result.success) setLoginStep("emailCode");
    else setError(result.error ?? "Couldn't send the code");
  }

  async function handleVerifyEmailCode() {
    setPending(true);
    setError(null);
    const result = await verifyEmailAction(email.trim(), emailCode);
    setPending(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    // A brand-new phone account has nothing in it, so any account already holding this address
    // merges automatically — the user never sees a prompt, which is the point of doing this at
    // signup rather than later.
    onLoginSuccess();
  }

  async function handleGoogle() {
    setPending(true);
    try {
      // Google is a full-page redirect, so unlike the OTP path there is no client-side moment
      // afterwards to navigate from — the destination has to be decided before leaving.
      await signInWithGoogleAction(redirectTo);
      onLoginSuccess();
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthGateContext.Provider value={{ requireLogin }}>
      {children}

      {showLoginModal && (
        <div
          onClick={closeModal}
          className="fixed inset-0 bg-[var(--modal-scrim)] z-[100] flex items-center justify-center p-5"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface rounded-2xl w-[400px] max-w-full p-6 animate-[modalIn_0.2s_ease_both]"
          >
            <div className="flex justify-between items-center mb-4">
              <div className="font-lora font-bold text-[19px] text-text">
                {loginStep === "choose" && "Log in to continue"}
                {loginStep === "phone" && "Enter your phone number"}
                {loginStep === "otp" && "Enter the OTP"}
                {loginStep === "email" && "Add your email"}
                {loginStep === "emailCode" && "Confirm your email"}
              </div>
              <button onClick={closeModal} className="bg-transparent border-0 text-xl cursor-pointer text-muted">
                ✕
              </button>
            </div>

            {loginStep === "choose" && (
              <>
                <button onClick={() => setLoginStep("phone")} className={primaryButtonClass}>
                  Continue with Phone OTP
                </button>
                <button onClick={handleGoogle} disabled={pending} className={outlineButtonClass}>
                  G Continue with Google
                </button>
                <p className="text-xs text-muted mt-3.5 leading-[1.5]">
                  By continuing you agree to Bhavano&apos;s{" "}
                  <Link href="/terms" className="text-text-soft font-bold">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-text-soft font-bold">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </>
            )}

            {loginStep === "phone" && (
              <>
                <div className="flex gap-2 mb-3.5">
                  <div className="bg-surface-alt border border-border rounded-[9px] px-3.5 py-3 font-bold text-sm">+91</div>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="10-digit mobile number"
                    className={inputClass}
                  />
                </div>
                {error && <p className={errorClass}>{error}</p>}
                <button
                  onClick={handleSendOtp}
                  disabled={phone.length !== 10 || pending}
                  className={`${primaryButtonClass} ${phone.length === 10 ? "opacity-100" : "opacity-50"}`}
                >
                  Send OTP
                </button>
                <button onClick={() => setLoginStep("choose")} className={backButtonClass}>
                  ← Back
                </button>
              </>
            )}

            {loginStep === "otp" && (
              <>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="······"
                  className={`${inputClass} text-center tracking-[0.4em] mb-3.5`}
                />
                {error && <p className={errorClass}>{error}</p>}
                <button
                  onClick={handleVerifyOtp}
                  disabled={otp.length !== 6 || pending}
                  className={`${primaryButtonClass} ${otp.length === 6 ? "opacity-100" : "opacity-50"}`}
                >
                  Verify &amp; continue
                </button>
                <button onClick={() => setLoginStep("phone")} className={backButtonClass}>
                  ← Back
                </button>
              </>
            )}

            {loginStep === "email" && (
              <>
                <p className="text-[13px] text-muted m-0 mb-3">
                  So we can reach you about your ads — and so signing in with Google later brings
                  you back to this same account.
                </p>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={`${inputClass} mb-3.5`}
                />
                {error && <p className={errorClass}>{error}</p>}
                <button
                  onClick={handleSendEmailCode}
                  disabled={pending || !email.includes("@")}
                  className={`${primaryButtonClass} ${email.includes("@") ? "opacity-100" : "opacity-50"}`}
                >
                  {pending ? "Sending…" : "Send code"}
                </button>
                <button onClick={onLoginSuccess} className={backButtonClass}>
                  Skip for now
                </button>
              </>
            )}

            {loginStep === "emailCode" && (
              <>
                <p className="text-[13px] text-muted m-0 mb-3">
                  We sent a 6-digit code to {email}.
                </p>
                <input
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="······"
                  className={`${inputClass} text-center tracking-[0.4em] mb-3.5`}
                />
                {error && <p className={errorClass}>{error}</p>}
                <button
                  onClick={handleVerifyEmailCode}
                  disabled={emailCode.length !== 6 || pending}
                  className={`${primaryButtonClass} ${emailCode.length === 6 ? "opacity-100" : "opacity-50"}`}
                >
                  {pending ? "Verifying…" : "Verify & continue"}
                </button>
                <button onClick={() => setLoginStep("email")} className={backButtonClass}>
                  ← Back
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--toast-bg)] text-[var(--toast-text)] px-[22px] py-3 rounded-full text-sm font-semibold z-[200] animate-[fadein_0.2s_ease_both]">
          ✓ Logged in successfully
        </div>
      )}
    </AuthGateContext.Provider>
  );
}

const primaryButtonClass =
  "w-full bg-green text-on-green border-0 rounded-lg p-[13px] text-sm font-bold cursor-pointer mb-2.5";

const outlineButtonClass =
  "w-full bg-surface text-text border-[1.5px] border-border rounded-lg p-[13px] text-sm font-bold cursor-pointer";

// text-base on mobile for the same reason as lib/formStyles.ts: iOS zooms below 16px.
const inputClass =
  "flex-1 w-full border border-border rounded-[9px] px-3.5 py-3 text-base sm:text-sm outline-none bg-surface text-text";

const backButtonClass = "bg-transparent border-0 text-muted text-[13px] font-bold cursor-pointer mt-1";

const errorClass = "text-[#b3413a] text-[13px] mb-2.5";
