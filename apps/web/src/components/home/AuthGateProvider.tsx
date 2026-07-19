"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import { sendOtpAction, signInWithGoogleAction, verifyOtpAction } from "@/app/actions/auth";

type LoginStep = "choose" | "phone" | "otp";

interface AuthGateContextValue {
  requireLogin: () => void;
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

  function requireLogin() {
    setLoginStep("choose");
    setPhone("");
    setOtp("");
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
    if (result.success) {
      onLoginSuccess();
    } else {
      setError(result.error ?? "Incorrect OTP");
    }
  }

  async function handleGoogle() {
    setPending(true);
    try {
      await signInWithGoogleAction();
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

const inputClass = "flex-1 w-full border border-border rounded-[9px] px-3.5 py-3 text-sm outline-none bg-surface text-text";

const backButtonClass = "bg-transparent border-0 text-muted text-[13px] font-bold cursor-pointer mt-1";

const errorClass = "text-[#b3413a] text-[13px] mb-2.5";
