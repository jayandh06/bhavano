"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
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
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--modal-scrim)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)",
              borderRadius: 16,
              width: 400,
              maxWidth: "100%",
              padding: 24,
              animation: "modalIn 0.2s ease both",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 19, color: "var(--text)" }}>
                {loginStep === "choose" && "Log in to continue"}
                {loginStep === "phone" && "Enter your phone number"}
                {loginStep === "otp" && "Enter the OTP"}
              </div>
              <button
                onClick={closeModal}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            {loginStep === "choose" && (
              <>
                <button
                  onClick={() => setLoginStep("phone")}
                  style={primaryButtonStyle}
                >
                  Continue with Phone OTP
                </button>
                <button onClick={handleGoogle} disabled={pending} style={outlineButtonStyle}>
                  G Continue with Google
                </button>
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 14, lineHeight: 1.5 }}>
                  By continuing you agree to Bhavano&apos;s Terms of Service and Privacy Policy.
                </p>
              </>
            )}

            {loginStep === "phone" && (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <div
                    style={{
                      background: "var(--surface-alt)",
                      border: "1px solid var(--border)",
                      borderRadius: 9,
                      padding: "12px 14px",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    +91
                  </div>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="10-digit mobile number"
                    style={inputStyle}
                  />
                </div>
                {error && <p style={errorStyle}>{error}</p>}
                <button
                  onClick={handleSendOtp}
                  disabled={phone.length !== 10 || pending}
                  style={{ ...primaryButtonStyle, opacity: phone.length === 10 ? 1 : 0.5 }}
                >
                  Send OTP
                </button>
                <button onClick={() => setLoginStep("choose")} style={backButtonStyle}>
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
                  style={{ ...inputStyle, textAlign: "center", letterSpacing: "0.4em", marginBottom: 14 }}
                />
                {error && <p style={errorStyle}>{error}</p>}
                <button
                  onClick={handleVerifyOtp}
                  disabled={otp.length !== 6 || pending}
                  style={{ ...primaryButtonStyle, opacity: otp.length === 6 ? 1 : 0.5 }}
                >
                  Verify &amp; continue
                </button>
                <button onClick={() => setLoginStep("phone")} style={backButtonStyle}>
                  ← Back
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showToast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--toast-bg)",
            color: "var(--toast-text)",
            padding: "12px 22px",
            borderRadius: 9999,
            fontSize: 14,
            fontWeight: 600,
            zIndex: 200,
            animation: "fadein 0.2s ease both",
          }}
        >
          ✓ Logged in successfully
        </div>
      )}
    </AuthGateContext.Provider>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--green)",
  color: "var(--on-green)",
  border: "none",
  borderRadius: 8,
  padding: 13,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  marginBottom: 10,
};

const outlineButtonStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--surface)",
  color: "var(--text)",
  border: "1.5px solid var(--border)",
  borderRadius: 8,
  padding: 13,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "12px 14px",
  fontSize: 14,
  outline: "none",
  background: "var(--surface)",
  color: "var(--text)",
};

const backButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--muted)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  marginTop: 4,
};

const errorStyle: React.CSSProperties = {
  color: "#b3413a",
  fontSize: 13,
  marginBottom: 10,
};
