"use client";

import { useEffect, useState } from "react";
import {
  OWNER_ALERT_CHANNEL_LABELS,
  OWNER_ALERT_CHANNELS,
  type OwnerAlertChannel,
  type OwnerAlertPreferenceDto,
} from "@bhavano/types/ownerAlerts";
import { getAlertPreferencesAction, saveAlertPrimaryChannelAction } from "@/app/actions/users";

/** Asked once, on the screen where the advertiser is most engaged: where to alert them when a seeker contacts them. Renders nothing once they have
 * answered (here or on the Profile page), when logged out, or when no channel can reach them. */
export function PostSuccessAlertQuestion() {
  const [preference, setPreference] = useState<OwnerAlertPreferenceDto | null>(null);
  const [saved, setSaved] = useState<OwnerAlertChannel | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getAlertPreferencesAction().then((p) => {
      if (!cancelled) setPreference(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (saved) {
    return (
      <p className="text-[13px] text-text-soft m-0">
        Got it: we&apos;ll alert you by {OWNER_ALERT_CHANNEL_LABELS[saved]} first. Change it any time in your profile.
      </p>
    );
  }
  if (!preference || preference.confirmed) return null;
  const options = OWNER_ALERT_CHANNELS.filter((c) => preference.available[c]);
  if (options.length === 0) return null;

  return (
    <div className="w-full max-w-[440px] rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <p className="text-sm font-bold text-text m-0 mb-1">How should we alert you when someone contacts you?</p>
      <p className="text-[12px] text-muted m-0 mb-3">Pick the one you check fastest. The app is quickest.</p>
      <div className="flex flex-wrap gap-2">
        {options.map((channel) => (
          <button
            key={channel}
            type="button"
            onClick={() => {
              setSaved(channel);
              void saveAlertPrimaryChannelAction(channel);
            }}
            className="rounded-lg border-[1.5px] border-green bg-transparent px-3.5 py-2 text-[13px] font-bold text-green cursor-pointer"
          >
            {OWNER_ALERT_CHANNEL_LABELS[channel]}
          </button>
        ))}
      </div>
    </div>
  );
}
