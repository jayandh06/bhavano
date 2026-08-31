"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { hasAdminSessionAction, sendOtpAction, signInWithGoogleAction, verifyOtpAction } from "@/app/actions/auth";
import { AUTH_POPUP_MESSAGE } from "./AuthPopupComplete";

type Step = "choose" | "phone" | "otp";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const unauthorized = searchParams.get("error") === "unauthorized";

  const [step, setStep] = useState<Step>("choose");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSendOtp() {
    setPending(true);
    setError(null);
    const result = await sendOtpAction(phone);
    setPending(false);
    if (result.success) setStep("otp");
    else setError(result.error ?? "Failed to send OTP");
  }

  async function onVerifyOtp() {
    setPending(true);
    setError(null);
    const result = await verifyOtpAction(phone, otp);
    setPending(false);
    if (result.success) router.push("/");
    else setError(result.error ?? "Incorrect OTP");
  }

  /**
   * Google sign-in in a child window, so this page never unloads.
   *
   * It used to hand the whole tab to Google and let NextAuth's redirect bring it back — which
   * works, but means a rejected account (a real Google login, just not one the BFF has marked
   * admin) only finds out after a full round trip through "/" and back to "/login?error=
   * unauthorized". The popup's completion page checks the same admin-role condition
   * `requireAdmin` does and reports it directly, so that message can show here instead.
   *
   * Falls back to the old full-page flow when there is no usable popup — a blocker, or a browser
   * that refuses the window.
   */
  async function onGoogleSignIn() {
    setPending(true);
    setError(null);

    const popup = window.open(
      "/auth/google",
      "bhavano-admin-google-auth",
      "width=480,height=620,menubar=no,toolbar=no,location=no,status=no",
    );
    if (!popup) {
      await signInWithGoogleAction();
      return;
    }

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearInterval(closedTimer);
      setPending(false);
    };

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== AUTH_POPUP_MESSAGE) return;
      cleanup();
      if (event.data.ok) {
        router.push("/");
      } else {
        setError(
          event.data.reason === "unauthorized"
            ? "That account doesn't have admin access."
            : "Sign-in was not completed.",
        );
      }
    }

    // A closed window is not proof of failure — the message is the normal path, not a
    // guarantee — so a login that landed without one is verified rather than assumed. If it
    // genuinely was just closed with nothing completed, there is nothing to report: the form is
    // already sitting right here, unlike web's modal, so there is no dialog to put back either.
    const closedTimer = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      void hasAdminSessionAction().then((isAdmin) => {
        if (isAdmin) router.push("/");
      });
    }, 500);

    window.addEventListener("message", onMessage);
  }

  return (
    <div
      style={{
        width: 380,
        maxWidth: "100%",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 28,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>Bhavano Admin</div>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 20px" }}>
        Restricted to admin accounts only.
      </p>

      {unauthorized && (
        <p style={{ fontSize: 13, color: "var(--danger)", marginBottom: 16 }}>
          That account doesn&apos;t have admin access.
        </p>
      )}

      {step === "choose" && (
        <>
          <button onClick={() => setStep("phone")} style={primaryButtonStyle}>
            Continue with Phone OTP
          </button>
          <button onClick={onGoogleSignIn} style={outlineButtonStyle} disabled={pending}>
            Continue with Google
          </button>
        </>
      )}

      {step === "phone" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <div style={countryChipStyle}>+91</div>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit mobile number"
              style={inputStyle}
            />
          </div>
          {error && <p style={errorStyle}>{error}</p>}
          <button
            onClick={onSendOtp}
            disabled={phone.length !== 10 || pending}
            style={{ ...primaryButtonStyle, opacity: phone.length === 10 ? 1 : 0.5 }}
          >
            {pending ? "Sending…" : "Send OTP"}
          </button>
          <button onClick={() => setStep("choose")} style={backButtonStyle}>
            ← Back
          </button>
        </>
      )}

      {step === "otp" && (
        <>
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="······"
            style={{ ...inputStyle, textAlign: "center", letterSpacing: "0.4em", marginBottom: 14 }}
          />
          {error && <p style={errorStyle}>{error}</p>}
          <button
            onClick={onVerifyOtp}
            disabled={otp.length !== 6 || pending}
            style={{ ...primaryButtonStyle, opacity: otp.length === 6 ? 1 : 0.5 }}
          >
            {pending ? "Verifying…" : "Verify & continue"}
          </button>
          <button onClick={() => setStep("phone")} style={backButtonStyle}>
            ← Back
          </button>
        </>
      )}
    </div>
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

const countryChipStyle: React.CSSProperties = {
  background: "var(--surface-alt)",
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "12px 14px",
  fontWeight: 700,
  fontSize: 14,
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
  color: "var(--danger)",
  fontSize: 13,
  marginBottom: 10,
};
