"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { PublicLoginNudgeDto } from "@bhavano/types";
import { shouldShowWebLoginPrompt } from "@bhavano/types/loginNudge";
import { recordInterestAction } from "@/app/actions/listings";
import { pushDataLayerEvent } from "@/lib/gtm";
import { recordVisitEntry } from "@/lib/visitEntry";
import { useAuthGate } from "./AuthGateProvider";

const DETAIL_VIEWS_KEY = "bhavano.nudge.detailViews";
const SHOWN_KEY = "bhavano.nudge.shown";
const DISMISSED_AT_KEY = "bhavano.nudge.dismissedAt";
const VIEWER_KEY = "bhavano.viewerKey";
/** A beat to see the listing before Google's own sign-in prompt slides in. */
const ONE_TAP_DELAY_MS = 2000;

interface GoogleIdentity {
  initialize(config: Record<string, unknown>): void;
  prompt(): void;
  cancel(): void;
}

/** GIS's `google.accounts.id`. Read through a cast because `window.google` is already typed by
 * the Maps definitions, which don't know about GIS. */
function googleIdentity(): GoogleIdentity | undefined {
  return (window as unknown as { google?: { accounts?: { id?: GoogleIdentity } } }).google?.accounts?.id;
}

/**
 * The dismissible login ask on listing detail, for logged-out non-owners only. Nothing here
 * changes the page's server-rendered HTML: crawlers and visitors get the same listing, and both
 * asks mount after hydration and can be dismissed. See docs/plans/listing-detail-login-nudge.md.
 *
 * On a given page view it's one or the other. The card when its rules pass; otherwise Google One
 * Tap. On a phone One Tap is itself a bottom sheet, and two stacked asks read as a wall.
 */
export function ListingLoginNudge({
  listingId,
  settings,
  googleClientId,
}: {
  listingId: string;
  settings: PublicLoginNudgeDto;
  googleClientId?: string;
}) {
  const { requireLogin, completeGoogleOneTap } = useAuthGate();
  const [showCard, setShowCard] = useState(false);
  const [useOneTap, setUseOneTap] = useState(false);
  /** Decided once per mount, so this page view counts once even when the effect re-runs. */
  const decision = useRef<"card" | "one-tap" | "none" | null>(null);

  useEffect(() => {
    decision.current ??= decide();
    const ask = decision.current;
    if (ask === "none") return;
    const timer = window.setTimeout(
      () => {
        if (ask === "one-tap") {
          setUseOneTap(true);
          return;
        }
        sessionStorage.setItem(SHOWN_KEY, "1");
        setShowCard(true);
        pushDataLayerEvent("login_nudge_shown", { surface: "web_prompt" });
      },
      ask === "card" ? settings.webPromptDelaySeconds * 1000 : ONE_TAP_DELAY_MS,
    );
    return () => window.clearTimeout(timer);

    function decide(): "card" | "one-tap" | "none" {
      const visitEntry = recordVisitEntry();
      const detailViews = Number(sessionStorage.getItem(DETAIL_VIEWS_KEY) ?? "0") + 1;
      sessionStorage.setItem(DETAIL_VIEWS_KEY, String(detailViews));
      const cardDue = shouldShowWebLoginPrompt({
        enabled: settings.webPromptEnabled,
        afterDetailViews: settings.webPromptAfterDetailViews,
        rolloutPercent: settings.webPromptRolloutPercent,
        excludeAdAndSearchLanding: settings.excludeAdAndSearchLanding,
        cooldownDays: settings.dismissCooldownDays,
        detailViewsThisSession: detailViews,
        visitEntry,
        viewerKey: localStorage.getItem(VIEWER_KEY) ?? "",
        dismissedAtMs: Number(localStorage.getItem(DISMISSED_AT_KEY) ?? "") || null,
        shownThisSession: sessionStorage.getItem(SHOWN_KEY) === "1",
        nowMs: Date.now(),
      });
      if (cardDue) return "card";
      return settings.webOneTapEnabled && googleClientId ? "one-tap" : "none";
    }
  }, [settings, googleClientId]);

  function onLoggedIn(surface: "web_prompt" | "one_tap") {
    pushDataLayerEvent("login_nudge_login", { surface });
    void recordInterestAction(listingId);
  }

  function startOneTap() {
    const id = googleIdentity();
    if (!id || !googleClientId) return;
    id.initialize({
      client_id: googleClientId,
      callback: ({ credential }: { credential?: string }) => {
        if (credential) void completeGoogleOneTap(credential, () => onLoggedIn("one_tap"));
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      itp_support: true,
      use_fedcm_for_prompt: true,
      context: "signin",
    });
    id.prompt();
    pushDataLayerEvent("login_nudge_shown", { surface: "one_tap" });
  }

  useEffect(() => {
    if (!useOneTap) return;
    return () => googleIdentity()?.cancel();
  }, [useOneTap]);

  function onNotNow() {
    localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    setShowCard(false);
    pushDataLayerEvent("login_nudge_dismissed", { surface: "web_prompt" });
  }

  function onLogIn() {
    setShowCard(false);
    requireLogin({ onSuccess: () => onLoggedIn("web_prompt") });
  }

  return (
    <>
      {useOneTap && (
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={startOneTap} />
      )}
      {showCard && (
        <div
          role="dialog"
          aria-label="Log in"
          className="fixed z-40 bottom-3 inset-x-3 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[380px] rounded-xl border border-border bg-surface text-text shadow-lg p-4"
        >
          <p className="font-bold text-[15px] m-0">Log in to hear back from owners faster</p>
          <p className="text-[13px] text-text-soft mt-1 mb-3">
            {settings.freeRevealsPerUser > 0
              ? `See ${settings.freeRevealsPerUser} owner phone numbers free, save listings and get alerts for new ones.`
              : "Save listings, message owners and get alerts for new ones."}
          </p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onNotNow}
              className="bg-transparent border border-border text-text-soft rounded-lg px-4 py-2 text-[13px] font-bold cursor-pointer"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={onLogIn}
              className="bg-green text-on-green border-0 rounded-lg px-5 py-2 text-[13px] font-bold cursor-pointer"
            >
              Log in
            </button>
          </div>
        </div>
      )}
    </>
  );
}
