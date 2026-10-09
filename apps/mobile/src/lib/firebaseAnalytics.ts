import { getAnalytics, logEvent } from "@react-native-firebase/analytics";

/**
 * Reports a completed post straight to GA4-for-Firebase, under the same event name
 * ("post_ad_success") the web side already uses — see
 * docs/plans/firebase-analytics-and-app-campaign.md for why this exists: without it, a Google
 * Ads App campaign has no in-app signal to optimize toward beyond raw install count.
 *
 * v26's modular API (getAnalytics() + a free logEvent(), not a default-exported analytics()
 * namespace) — this package dropped the old v8-style namespaced API.
 *
 * Best-effort, same stance as every other analytics call in this app (analyticsSession.ts) —
 * this must never surface an error into the posting flow it's reporting on.
 */
export async function logPostAdSuccess(params: {
  category: string;
  transactionType: string;
}): Promise<void> {
  try {
    logEvent(getAnalytics(), "post_ad_success", params);
  } catch {
    // Offline, or Analytics not yet enabled on the Firebase project — either way, silent.
  }
}

/** Mobile-side mirror of web's `post_page_view`/`post_step_view`/`post_login_required`/
 * `post_error` (PostAdWizard.tsx's StepTracker/reportPostError) — see
 * docs/plans/post-ad-funnel-step-tracking-and-entry-attribution.md. Until now mobile had only
 * `logPostAdSuccess` above, so a drop-off anywhere before the final step was invisible here even
 * though web already had GTM-level visibility into all five. Each is best-effort, same stance as
 * every analytics call in this app. */
export async function logPostPageView(params: { loggedIn: boolean; entry: string }): Promise<void> {
  try {
    logEvent(getAnalytics(), "post_page_view", params);
  } catch {
    // Offline, or Analytics not yet enabled — either way, silent.
  }
}

export async function logPostStepView(params: { step: string; entry: string }): Promise<void> {
  try {
    logEvent(getAnalytics(), "post_step_view", params);
  } catch {
    // Offline, or Analytics not yet enabled — either way, silent.
  }
}

export async function logPostLoginRequired(params: { step: string }): Promise<void> {
  try {
    logEvent(getAnalytics(), "post_login_required", params);
  } catch {
    // Offline, or Analytics not yet enabled — either way, silent.
  }
}

export async function logPostError(params: { stage: string; message: string }): Promise<void> {
  try {
    logEvent(getAnalytics(), "post_error", params);
  } catch {
    // Offline, or Analytics not yet enabled — either way, silent.
  }
}
