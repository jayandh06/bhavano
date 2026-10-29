import { useEffect, useState } from "react";
import { DEFAULT_SEEKER_CONTACT_SETTINGS, type SeekerContactSettingsDto } from "@bhavano/types/seekerContact";
import { fetchSeekerContactSettings } from "./bffClient";

let cached: Promise<SeekerContactSettingsDto> | null = null;

/** Whether owners may see interested people's numbers, and in which mode (Admin -> Settings -> Seeker contact). Off until the lookup says otherwise, so nothing is claimed that is not
 * true; one lookup per app launch, shared by every screen that asks, and a failure keeps it off. */
export function useSeekerContactSettings(): SeekerContactSettingsDto {
  const [settings, setSettings] = useState<SeekerContactSettingsDto>(DEFAULT_SEEKER_CONTACT_SETTINGS);
  useEffect(() => {
    cached ??= fetchSeekerContactSettings().catch(() => {
      cached = null;
      return DEFAULT_SEEKER_CONTACT_SETTINGS;
    });
    let alive = true;
    void cached.then((s) => alive && setSettings(s));
    return () => {
      alive = false;
    };
  }, []);
  return settings;
}
