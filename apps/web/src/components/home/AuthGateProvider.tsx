"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  checkNewSignupAction,
  hasSessionAction,
  sendOtpAction,
  signInWithGoogleAction,
  verifyOtpAction,
} from "@/app/actions/auth";
import { requestEmailCodeAction, verifyEmailAction } from "@/app/actions/users";
import { pushDataLayerEvent, toE164IN } from "@/lib/gtm";
import { AUTH_POPUP_MESSAGE } from "./AuthPopupComplete";
import { GOOGLE_SIGNUP_TRACKED_KEY } from "./SignupConversionTracker";
import { GoogleIcon } from "./GoogleIcon";
import { Icon } from "./Icon";

/** `email` and `emailCode` only ever follow a brand-new phone signup — see handleVerifyOtp. */
type LoginStep = "choose" | "phone" | "otp" | "email" | "emailCode";

interface AuthGateContextValue {
  /** `redirectTo` sends the user back to a specific path once logged in, instead of wherever the
   * login flow would otherwise leave them. Pass it when the page they are on only exists to be
   * used logged in — /post — so finishing the login continues what they came to do. Omit it for
   * the header's Login button, which is not tied to any particular intent.
   *
   * `onSuccess` resumes whatever the login interrupted, in place. The posting wizard uses it to
   * carry on submitting the ad the user just pressed Publish on: without it they would log in,
   * find the form exactly as they left it, and have to press the same button a second time —
   * which reads as the first press having failed. */
  requireLogin: (options?: { redirectTo?: string; onSuccess?: () => void }) => void;
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
  const onSuccessRef = useRef<(() => void) | undefined>(undefined);

  const router = useRouter();

  function requireLogin(options?: { redirectTo?: string; onSuccess?: () => void }) {
    setRedirectTo(options?.redirectTo);
    // A ref, not state: this fires once from inside onLoginSuccess and must not cause a render
    // of its own on the way in.
    onSuccessRef.current = options?.onSuccess;
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

    // Cleared before calling, so a caller that somehow triggers another login from inside its
    // own callback cannot re-enter this one.
    const resume = onSuccessRef.current;
    onSuccessRef.current = undefined;
    resume?.();
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
      // The just-verified number is the Enhanced Conversions user-provided data for this signup.
      const phoneE164 = toE164IN(phone);
      pushDataLayerEvent("signup_complete", {
        method: "phone",
        ...(phoneE164 ? { user_data: { phone_number: phoneE164 } } : {}),
      });
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

  /**
   * `signup_complete` for a Google signup that happened in the popup.
   *
   * SignupConversionTracker used to cover this by mounting on the page load that the redirect
   * caused. The popup's whole point is that there is no such load, so without this a Google
   * signup would stop reporting a conversion — silently, on the campaigns actually being paid
   * for. Same sessionStorage key as that component, so the two cannot both count one signup.
   */
  async function trackGoogleSignup() {
    if (sessionStorage.getItem(GOOGLE_SIGNUP_TRACKED_KEY)) return;
    const { isNewUser, provider, email } = await checkNewSignupAction();
    if (isNewUser && provider === "google") {
      pushDataLayerEvent("signup_complete", {
        method: "google",
        ...(email ? { user_data: { email } } : {}),
      });
      sessionStorage.setItem(GOOGLE_SIGNUP_TRACKED_KEY, "1");
    }
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

  /**
   * Google sign-in in a child window, so this page never unloads.
   *
   * It used to hand the whole tab to Google. Everything on the page died with it, and NextAuth
   * came back to "/" — so someone who tapped "Contact owner" on a listing and chose Google was
   * returned to the homepage without the listing they were asking about. Five other call sites
   * pass no redirectTo either and had the same ending. A popup fixes all of them at once, and
   * not by threading a destination through six places: there is no navigation, so there is no
   * destination to get wrong.
   *
   * It also makes the /post flow survivable. A wizard full of photos holds File objects, which
   * cannot be serialised anywhere — the only way to keep them across a login is to not tear the
   * page down.
   *
   * Falls back to the old full-page flow when there is no usable popup — a blocker, or a browser
   * that refuses the window. That path still works; it is simply the experience everyone had
   * before this.
   */
  async function handleGoogle() {
    setPending(true);
    setError(null);

    const popup = window.open(
      "/auth/google",
      "bhavano-google-auth",
      "width=500,height=640,menubar=no,toolbar=no,location=no,status=no",
    );
    if (!popup) {
      await signInWithGoogleAction(redirectTo);
      return;
    }

    // Out of the way while Google's window has the user's attention. Leaving it up meant asking
    // someone to log in on top of the login they are already doing — and on a phone, where the
    // popup is a tab rather than a window, they come back to a dialog that looks like nothing
    // happened. It returns below if they close Google without signing in, so backing out lands
    // them exactly where they were rather than on a page with no way back in.
    setShowLoginModal(false);

    // Two ways this ends, because only one of them is reliable. The popup reports back when it
    // reaches our own completion page; but a user who closes the window mid-flow sends nothing,
    // and without the poll the dialog would sit disabled forever waiting for a message that is
    // never coming.
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearInterval(closedTimer);
      setPending(false);
    };

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== AUTH_POPUP_MESSAGE) return;
      cleanup();
      if (!event.data.ok) {
        setShowLoginModal(true);
        setError("Sign-in was not completed.");
        return;
      }
      onLoginSuccess();
      void trackGoogleSignup();
    }

    // A closed window is not proof of failure — the message is the normal path, not a
    // guarantee, and a login that landed without one would otherwise leave this dialog sitting
    // open over a page the user is already signed into. So ask, rather than assume.
    const closedTimer = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      void hasSessionAction().then((signedIn) => {
        if (signedIn) {
          onLoginSuccess();
          void trackGoogleSignup();
          return;
        }
        // Closed the window without finishing — put the choices back, on the step they left.
        setShowLoginModal(true);
      });
    }, 500);

    window.addEventListener("message", onMessage);
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
                <Icon name="close" />
              </button>
            </div>

            {loginStep === "choose" && (
              <>
                {/* Google first — most visitors already have a Google account signed into
                  * their browser, so it is usually one click with nothing to type, where phone
                  * OTP always costs a wait for the SMS. White with a border and the official
                  * colour mark, not the app's own green: Google's own button guidelines call for
                  * a neutral surface so the coloured logo itself is what reads as "Google," the
                  * same convention practically every Google sign-in button follows regardless of
                  * the host app's own palette. */}
                <button
                  onClick={handleGoogle}
                  disabled={pending}
                  className="w-full flex items-center justify-center gap-2.5 bg-surface text-text border-[1.5px] border-border rounded-lg p-[13px] text-sm font-bold cursor-pointer mb-2.5"
                >
                  <GoogleIcon /> Continue with Google
                </button>
                <button onClick={() => setLoginStep("phone")} className={outlineButtonClass}>
                  Continue with Phone OTP
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
          <Icon name="check" /> Logged in successfully
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
