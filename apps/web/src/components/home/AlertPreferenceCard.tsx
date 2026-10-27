"use client";

import { useState, useTransition } from "react";
import {
  OWNER_ALERT_CHANNEL_LABELS,
  OWNER_ALERT_CHANNELS,
  isPaidOwnerAlertChannel,
  type OwnerAlertChannel,
  type OwnerAlertPreferenceDto,
} from "@bhavano/types/ownerAlerts";
import { saveAlertPrimaryChannelAction } from "@/app/actions/users";
import { Icon } from "./Icon";
import { InstallAppAlertBanner } from "./InstallAppAlertBanner";

/** Why a channel cannot be picked as the first choice. */
const UNAVAILABLE_HINT: Record<OwnerAlertChannel, string> = {
  push: "Install the Bhavano app and log in to use this",
  whatsapp: "Add your phone number to use this",
  sms: "Add your phone number to use this",
  email: "Add your email address to use this",
};

/** Where the advertiser says how to reach them when a seeker messages, shows interest or views their number. One primary channel is the whole question
 * (a ranked list is too heavy on a phone); the others follow in the default order as fallbacks. See docs/plans/owner-notification-channel-preferences.md. */
export function AlertPreferenceCard({ preference }: { preference: OwnerAlertPreferenceDto }) {
  const [current, setCurrent] = useState(preference);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(channel: OwnerAlertChannel) {
    setError(null);
    startTransition(async () => {
      const result = await saveAlertPrimaryChannelAction(channel);
      if (result.success && result.preference) setCurrent(result.preference);
      else setError(result.error ?? "Could not save");
    });
  }

  const primary = current.confirmed ? current.channels[0] : null;
  const fallbacks = current.channels.filter((c) => c !== current.channels[0] && current.available[c]);

  return (
    <section className="border border-border rounded-2xl p-6 bg-surface">
      {!current.available.push && <InstallAppAlertBanner campaign="profile" />}
      <div className="font-lora text-lg font-bold text-text mb-1 flex items-center gap-2">
        <Icon name="bell" /> How should we alert you?
      </div>
      <p className="text-[13px] text-muted m-0 mb-3">
        When someone messages you, shows interest or views your number, we tell you here first. Mobile App notifications and email are free; WhatsApp and SMS are included with Featured ads.
      </p>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="First alert channel">
        {OWNER_ALERT_CHANNELS.map((channel) => {
          const usable = current.available[channel];
          const selected = primary === channel;
          return (
            <label
              key={channel}
              className={`flex items-start gap-2.5 text-[13px] rounded-lg border px-3 py-2 ${
                selected ? "border-green bg-green/5" : "border-border"
              } ${usable ? "cursor-pointer" : "opacity-60"}`}
            >
              <input
                type="radio"
                name="alert-channel"
                className="mt-0.5"
                checked={selected}
                disabled={!usable || pending}
                onChange={() => choose(channel)}
              />
              <span>
                <span className="font-semibold text-text">{OWNER_ALERT_CHANNEL_LABELS[channel]}</span>
                {isPaidOwnerAlertChannel(channel) ? (
                  <span className="ml-1.5 rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[11px] font-bold text-text">Featured ads</span>
                ) : (
                  <span className="text-muted"> (free{channel === "push" ? ", fastest" : ""})</span>
                )}
                {!usable && <span className="block text-muted">{UNAVAILABLE_HINT[channel]}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {primary && fallbacks.length > 0 && (
        <p className="text-[12px] text-muted m-0 mt-3">
          If that cannot reach you, we try {fallbacks.map((c) => OWNER_ALERT_CHANNEL_LABELS[c]).join(", then ")}.
        </p>
      )}
      {error && <p className="text-[12px] text-red-600 m-0 mt-2">{error}</p>}
    </section>
  );
}
