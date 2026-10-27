"use client";

import { useEffect, useMemo, useState } from "react";
import {
  effectiveOwnerAlertChannel,
  isPaidOwnerAlertChannel,
  OWNER_ALERT_CHANNEL_LABELS,
  OWNER_ALERT_CHANNELS,
  withPrimaryChannel,
  type OwnerAlertChannel,
  type OwnerAlertPreferenceDto,
} from "@bhavano/types/ownerAlerts";
import { getAlertPreferencesAction } from "@/app/actions/users";
import { Icon } from "./Icon";
import { InstallAppAlertBanner } from "./InstallAppAlertBanner";

export interface AlertChannelChoice {
  /** False blocks posting: no channel can reach the owner for this ad and they have not said they will check Messages themselves. */
  ready: boolean;
  /** The first channel to try, or null if the preference could not be loaded. */
  primary: OwnerAlertChannel | null;
}

const UNAVAILABLE_HINT: Record<OwnerAlertChannel, string> = {
  push: "Install the Bhavano app and log in to use this",
  whatsapp: "Add your phone number to use this",
  sms: "Add your phone number to use this",
  email: "Add and verify your email in your profile to use this",
};

/** The required "how should we alert you?" answer on the Preview step, just above Post. Push and email are free; WhatsApp and SMS belong to Featured
 * ads, so they unlock when a Featured plan is picked on this same page. Pre-filled with the best free channel the owner can be reached on, so it is a
 * confirmation rather than a chore; it only blocks posting when nothing can reach them (a phone-only owner without the app) until they say they will check
 * Messages themselves, add an email, or go Featured. See docs/plans/owner-notification-channel-preferences.md. */
export function AlertChannelPicker({
  featured,
  onChange,
}: {
  featured: boolean;
  onChange: (choice: AlertChannelChoice) => void;
}) {
  const [pref, setPref] = useState<OwnerAlertPreferenceDto | null>(null);
  const [picked, setPicked] = useState<OwnerAlertChannel | null>(null);
  const [checkMyself, setCheckMyself] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getAlertPreferencesAction().then((p) => {
      if (cancelled || !p) return;
      setPref(p);
      // An owner who already chose keeps their choice; a new one starts on the best free channel they can be reached on.
      setPicked(p.confirmed ? p.channels[0] : p.available.push ? "push" : p.available.email ? "email" : null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const order = useMemo(() => (pref ? withPrimaryChannel(pref.channels, picked ?? pref.channels[0]) : []), [pref, picked]);
  const effective = pref ? effectiveOwnerAlertChannel(order, pref.available, featured) : null;
  const ready = !pref || effective !== null || checkMyself;

  useEffect(() => {
    // Someone who says they will check Messages themselves still gets a recorded choice (so they are not asked again on every post).
    onChange({ ready, primary: pref ? (picked ?? (checkMyself ? "push" : null)) : null });
  }, [ready, picked, checkMyself, pref, onChange]);

  if (!pref) return null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      {!pref.available.push && <InstallAppAlertBanner campaign="post_review" />}
      <p className="text-sm font-bold text-text m-0 mb-1 flex items-center gap-2">
        <Icon name="bell" /> How should we alert you when someone contacts you?
      </p>
      <p className="text-[12px] text-muted m-0 mb-3">
        App notifications and email are free. WhatsApp and SMS are included with Featured ads.
      </p>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="First alert channel">
        {OWNER_ALERT_CHANNELS.map((channel) => {
          const paid = isPaidOwnerAlertChannel(channel);
          const reachable = pref.available[channel];
          const locked = paid && !featured;
          const usable = reachable && !locked;
          const selected = picked === channel;
          return (
            <label
              key={channel}
              className={`flex items-start gap-2.5 text-[13px] rounded-lg border px-3 py-2 ${
                selected ? "border-green bg-green/5" : "border-border"
              } ${usable ? "cursor-pointer" : "opacity-60"}`}
            >
              <input
                type="radio"
                name="review-alert-channel"
                className="mt-0.5"
                checked={selected}
                disabled={!usable}
                onChange={() => setPicked(channel)}
              />
              <span>
                <span className="font-semibold text-text">{OWNER_ALERT_CHANNEL_LABELS[channel]}</span>
                {paid ? (
                  <span className="ml-1.5 rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[11px] font-bold text-text">Featured</span>
                ) : (
                  <span className="text-muted"> (free{channel === "push" ? ", fastest" : ""})</span>
                )}
                {!reachable ? (
                  <span className="block text-muted">{UNAVAILABLE_HINT[channel]}</span>
                ) : locked ? (
                  <span className="block text-muted">Choose a Featured plan above to alert you here</span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
      {!effective && (
        <label className="flex items-start gap-2.5 text-[13px] mt-3 cursor-pointer">
          <input type="checkbox" className="mt-0.5" checked={checkMyself} onChange={(e) => setCheckMyself(e.target.checked)} />
          <span className="text-text-soft">
            None of these can reach me right now. I&apos;ll check Messages on Bhavano myself (or choose a Featured plan for WhatsApp and SMS alerts).
          </span>
        </label>
      )}
    </section>
  );
}
