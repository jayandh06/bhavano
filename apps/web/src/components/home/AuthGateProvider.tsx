"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  checkNewSignupAction,
  hasSessionAction,
  sendOtpAction,
  signInWithGoogleAction,
  signOutAction,
  verifyOtpAction,
} from "@/app/actions/auth";
import { fetchProfileAction, resolvePostLoginRedirectAction } from "@/app/actions/users";
import { pushDataLayerEvent, toE164IN } from "@/lib/gtm";
import { AUTH_POPUP_MESSAGE } from "./AuthPopupComplete";
import { GOOGLE_SIGNUP_TRACKED_KEY } from "./SignupConversionTracker";
import { GoogleIcon } from "./GoogleIcon";
import { Icon } from "./Icon";
import {
  ProfileBasicsCloseButton,
  ProfileBasicsStep,
  basicsFromProfile,
  canDismissBasics,
  profileNeedsBasics,
  profileNeedsMandatoryBasics,
  type ProfileBasicsValues,
} from "./ProfileBasicsStep";

/** `basics` = name + verified secondary + optional city after login — see
 * docs/plans/post-login-name-and-city.md. */
type LoginStep = "choose" | "phone" | "otp" | "basics";

interface AuthGateContextValue {
  /** `redirectTo` sends the user back to a specific path once logged in, instead of wherever the
   * login flow would otherwise leave them. Pass it when the page they are on only exists to be
   * used logged in — /post — so finishing the login continues what they came to do. Omit it for
   * the header's Login button, which is not tied to any particular intent.
   *
   * `onSuccess` resumes whatever the login interrupted, in place. The posting wizard uses it to
   * carry on submitting the ad the user just pressed Publish on: without it they would log in,
   * find the form exactly as they left it, and have to press the same button a second time —
   * which reads as the first press having failed.
   *
   * `phoneOnly` hides the Google option — for a flow like claim-listing where the backend only
   * ever accepts a login whose own phone number matches a specific one on file
   * (ListingsService.claimListing): a Google/email account can be signed into successfully and
   * still always fail that check, so offering it here is a guaranteed dead end, not a real
   * choice. */
  requireLogin: (options?: { redirectTo?: string; onSuccess?: () => void; phoneOnly?: boolean }) => void;
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
  const [redirectTo, setRedirectTo] = useState<string | undefined>(undefined);
  const [phoneOnly, setPhoneOnly] = useState(false);
  const [basicsInitial, setBasicsInitial] = useState<ProfileBasicsValues>({
    name: "",
    cityId: null,
    cityName: null,
    phone: null,
    email: null,
    emailVerified: false,
    needSecondary: "email",
  });
  const onSuccessRef = useRef<(() => void) | undefined>(undefined);
  /** True when basics was opened for an already-signed-in session (or full-page Google return),
   * not a fresh AuthGate login — complete without toast / post-login redirect. */
  const quietBasicsRef = useRef(false);
  const sessionBasicsCheckedRef = useRef(false);

  const router = useRouter();

  function requireLogin(options?: { redirectTo?: string; onSuccess?: () => void; phoneOnly?: boolean }) {
    setRedirectTo(options?.redirectTo);
    setPhoneOnly(options?.phoneOnly ?? false);
    // A ref, not state: this fires once from inside onLoginSuccess and must not cause a render
    // of its own on the way in.
    onSuccessRef.current = options?.onSuccess;
    quietBasicsRef.current = false;
    setLoginStep("choose");
    setPhone("");
    setOtp("");
    setError(null);
    setShowLoginModal(true);
  }

  function closeModal() {
    // Name + verified secondary are mandatory — backdrop / X must not abandon an incomplete
    // profile. City-only gaps may dismiss (canDismissBasics).
    if (loginStep === "basics" && !canDismissBasics(basicsInitial)) return;
    setShowLoginModal(false);
  }

  function openBasics(profile: Parameters<typeof basicsFromProfile>[0], quiet: boolean) {
    quietBasicsRef.current = quiet;
    setBasicsInitial(basicsFromProfile(profile));
    setError(null);
    setPending(false);
    setLoginStep("basics");
    setShowLoginModal(true);
  }

  function onBasicsComplete() {
    if (quietBasicsRef.current) {
      quietBasicsRef.current = false;
      setShowLoginModal(false);
      router.refresh();
      return;
    }
    onLoginSuccess();
  }

  /** After OTP/Google succeeds: name + verified secondary required; city optional —
   * docs/plans/post-login-name-and-city.md. */
  async function finishAuthOrPromptBasics(profileHint?: Parameters<typeof basicsFromProfile>[0]) {
    if (profileHint) {
      if (profileNeedsBasics(profileHint)) {
        openBasics(profileHint, false);
        return;
      }
      onLoginSuccess();
      return;
    }

    // After phone OTP, the next server action can briefly miss the new session cookie — retry
    // before treating the user as done without a basics prompt.
    let profileResult = await fetchProfileAction();
    for (let attempt = 0; attempt < 3 && profileResult.requiresLogin; attempt++) {
      await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
      profileResult = await fetchProfileAction();
    }
    if (profileResult.requiresLogin) {
      // Soft navigations keep AuthGate mounted — allow a quiet recheck once the cookie lands.
      sessionBasicsCheckedRef.current = false;
      const opened = await promptMandatoryBasicsIfNeeded();
      if (!opened) onLoginSuccess();
      return;
    }
    const profile = profileResult.profile;
    if (profileNeedsBasics(profile)) {
      openBasics(profile, false);
      return;
    }
    onLoginSuccess();
  }

  /** @returns true when the basics sheet was opened. */
  async function promptMandatoryBasicsIfNeeded(): Promise<boolean> {
    // Brief retries — cookie from OTP signIn may not be visible on the first attempt.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 120 * attempt));
      const signedIn = await hasSessionAction();
      if (!signedIn) continue;
      const profileResult = await fetchProfileAction();
      if (profileResult.requiresLogin) continue;
      if (!profileNeedsMandatoryBasics(profileResult.profile)) {
        sessionBasicsCheckedRef.current = true;
        return false;
      }
      sessionBasicsCheckedRef.current = true;
      openBasics(profileResult.profile, true);
      return true;
    }
    return false;
  }

  /** Existing session / full-page Google return: force name + verified secondary if missing.
   * City-only gaps are not forced on every load (still optional). */
  useEffect(() => {
    if (sessionBasicsCheckedRef.current) return;
    sessionBasicsCheckedRef.current = true;
    let cancelled = false;
    void (async () => {
      const signedIn = await hasSessionAction();
      if (cancelled || !signedIn) {
        // Stay eligible to re-check after a same-session OTP login (layout does not remount).
        sessionBasicsCheckedRef.current = false;
        return;
      }
      const profileResult = await fetchProfileAction();
      if (cancelled || profileResult.requiresLogin) {
        sessionBasicsCheckedRef.current = false;
        return;
      }
      if (!profileNeedsMandatoryBasics(profileResult.profile)) return;
      openBasics(profileResult.profile, true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function onLoginSuccess() {
    setShowLoginModal(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2200);

    // Cleared before calling, so a caller that somehow triggers another login from inside its
    // own callback cannot re-enter this one.
    const resume = onSuccessRef.current;
    onSuccessRef.current = undefined;

    // Run the resume/redirect FIRST, then refresh — not the other way around. `resume` (e.g.
    // ListingCard's onMessage) often navigates away itself (router.push to /messages/[id]); a
    // refresh() queued *before* that push targets the page being navigated away from, and since
    // refresh() is async it can land after the push and briefly repaint the old page before the
    // push's own render wins — the exact "flashes the destination, then reverts" bug this order
    // fixes. Running refresh() last means it always applies to whatever the current route
    // actually is by the time it fires.
    if (resume) {
      resume();
      router.refresh();
      return;
    }
    if (redirectTo) {
      router.push(redirectTo);
      router.refresh();
      return;
    }

    void resolvePostLoginRedirectAction().then((path) => {
      if (path) router.push(path);
      router.refresh();
    });
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
    if (!result.success) {
      setPending(false);
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
    }

    await finishAuthOrPromptBasics(result.profile);
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
   * before this. AuthGate's mount check then opens basics if phone/name are still missing.
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
      void trackGoogleSignup();
      void finishAuthOrPromptBasics();
    }

    // A closed window is not proof of failure — the message is the normal path, not a
    // guarantee, and a login that landed without one would otherwise leave this dialog sitting
    // open over a page the user is already signed into. So ask, rather than assume.
    const closedTimer = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      void hasSessionAction().then((signedIn) => {
        if (signedIn) {
          void trackGoogleSignup();
          void finishAuthOrPromptBasics();
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
                {loginStep === "basics" && "Complete your profile"}
              </div>
              {loginStep === "basics" ? (
                <ProfileBasicsCloseButton
                  canDismiss={canDismissBasics(basicsInitial)}
                  onClose={closeModal}
                />
              ) : (
                <button onClick={closeModal} className="bg-transparent border-0 text-xl cursor-pointer text-muted">
                  <Icon name="close" />
                </button>
              )}
            </div>

            {loginStep === "choose" && (
              <>
                <button onClick={() => setLoginStep("phone")} className={`${outlineButtonClass} mb-2.5`}>
                  Continue with Phone OTP
                </button>
                {/* White with a border and the official colour mark, not the app's own green:
                  * Google's own button guidelines call for a neutral surface so the coloured
                  * logo itself is what reads as "Google," the same convention practically every
                  * Google sign-in button follows regardless of the host app's own palette.
                  *
                  * Hidden entirely when phoneOnly — offering it would just be a guaranteed dead
                  * end, see requireLogin's own doc comment. */}
                {!phoneOnly && (
                  <button
                    onClick={handleGoogle}
                    disabled={pending}
                    className="w-full flex items-center justify-center gap-2.5 bg-surface text-text border-[1.5px] border-border rounded-lg p-[13px] text-sm font-bold cursor-pointer"
                  >
                    <GoogleIcon /> Continue with Google
                  </button>
                )}
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

            {loginStep === "basics" && (
              <ProfileBasicsStep
                initial={basicsInitial}
                pending={pending}
                error={error}
                onError={setError}
                onPending={setPending}
                onSaved={onBasicsComplete}
                onSkip={onBasicsComplete}
                onReauthRequired={() => {
                  setShowLoginModal(false);
                  void signOutAction();
                }}
              />
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
