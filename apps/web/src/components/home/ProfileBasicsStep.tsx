"use client";

import { useEffect, useState } from "react";
import type { City } from "@bhavano/types";
import { searchCitiesAction } from "@/app/actions/locations";
import { updateProfileAction } from "@/app/actions/users";
import { Icon } from "./Icon";

const MIN_CITY_QUERY = 2;

export interface ProfileBasicsValues {
  name: string;
  cityId: string | null;
  cityName: string | null;
}

/**
 * Post-login name + optional preferred city — see docs/plans/post-login-name-and-city.md.
 * Name is required to continue; city is type-ahead (≥2 chars) and skippable when a name is
 * already present (Google) or left blank on Continue.
 */
export function ProfileBasicsStep({
  initial,
  pending,
  error,
  onError,
  onPending,
  onSaved,
  onSkip,
}: {
  initial: ProfileBasicsValues;
  pending: boolean;
  error: string | null;
  onError: (message: string | null) => void;
  onPending: (pending: boolean) => void;
  onSaved: (saved: ProfileBasicsValues) => void;
  /** Only offered when `initial.name` is already non-empty (provider-supplied). */
  onSkip: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [cityId, setCityId] = useState<string | null>(initial.cityId);
  const [cityName, setCityName] = useState<string | null>(initial.cityName);
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [showCityResults, setShowCityResults] = useState(false);
  const [cityNoResults, setCityNoResults] = useState(false);

  const nameOk = name.trim().length > 0;
  const canSkip = initial.name.trim().length > 0;

  useEffect(() => {
    setName(initial.name);
    setCityId(initial.cityId);
    setCityName(initial.cityName);
  }, [initial.name, initial.cityId, initial.cityName]);

  async function onCityQueryChange(value: string) {
    setCityQuery(value);
    setCityNoResults(false);
    if (value.trim().length < MIN_CITY_QUERY) {
      setCityResults([]);
      setShowCityResults(false);
      return;
    }
    const results = await searchCitiesAction(value.trim());
    setCityResults(results);
    setShowCityResults(results.length > 0);
    setCityNoResults(results.length === 0);
  }

  function selectCity(city: City) {
    setCityId(city.id);
    setCityName(city.name);
    setCityQuery("");
    setShowCityResults(false);
    setCityNoResults(false);
  }

  function clearCity() {
    setCityId(null);
    setCityName(null);
    setCityQuery("");
    setShowCityResults(false);
  }

  async function onContinue() {
    if (!nameOk) {
      onError("Please enter your name");
      return;
    }
    onPending(true);
    onError(null);
    const result = await updateProfileAction({
      name: name.trim(),
      ...(cityId ? { cityId } : {}),
    });
    onPending(false);
    if (!result.success) {
      onError(result.error ?? "Couldn't save");
      return;
    }
    onSaved({
      name: name.trim(),
      cityId: result.profile?.cityId ?? cityId,
      cityName: result.profile?.cityName ?? cityName,
    });
  }

  return (
    <div>
      <p className="text-[13px] text-muted m-0 mb-4">
        Sellers and buyers see your name in messages. Preferred city personalises what you browse —
        you can skip it for now.
      </p>

      <label className="block text-[11.5px] font-bold text-muted mb-1.5">Name</label>
      <input
        autoFocus={!initial.name.trim()}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className={inputClass}
        maxLength={80}
      />

      <label className="block text-[11.5px] font-bold text-muted mb-1.5 mt-3.5">
        Preferred city <span className="font-normal">(optional)</span>
      </label>
      {cityName && !cityQuery ? (
        <div className="flex items-center gap-2 border border-border rounded-[9px] px-3.5 py-3 mb-1">
          <span className="flex-1 text-base sm:text-sm text-text font-bold">{cityName}</span>
          <button type="button" onClick={clearCity} className="bg-transparent border-0 text-muted cursor-pointer text-sm">
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            value={cityQuery}
            onChange={(e) => void onCityQueryChange(e.target.value)}
            placeholder="Start typing your city…"
            className={inputClass}
            autoComplete="off"
          />
          {showCityResults && (
            <ul className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-auto bg-surface border border-border rounded-[9px] shadow-md m-0 p-0 list-none">
              {cityResults.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => selectCity(c)}
                    className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-surface-alt border-0 bg-transparent cursor-pointer text-text"
                  >
                    {c.name}
                    <span className="text-muted text-[12px]"> · {c.state}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {cityNoResults && (
            <p className="text-[12px] text-muted m-0 mt-1.5">No cities match — try another spelling.</p>
          )}
          {cityQuery.trim().length > 0 && cityQuery.trim().length < MIN_CITY_QUERY && (
            <p className="text-[12px] text-muted m-0 mt-1.5">Type at least {MIN_CITY_QUERY} characters to search.</p>
          )}
        </div>
      )}

      {error && <p className="text-[#b3413a] text-[13px] mt-3 mb-0">{error}</p>}

      <button
        type="button"
        onClick={() => void onContinue()}
        disabled={pending || !nameOk}
        className={`${primaryButtonClass} mt-4 ${nameOk ? "opacity-100" : "opacity-50"}`}
      >
        {pending ? "Saving…" : "Continue"}
      </button>

      {canSkip && (
        <button type="button" onClick={onSkip} disabled={pending} className={backButtonClass}>
          Skip for now
        </button>
      )}
    </div>
  );
}

/** Close control for the auth modal when the basics step is showing — blocked until a name
 * exists so phone signups can't dismiss without one. */
export function ProfileBasicsCloseButton({
  canDismiss,
  onClose,
}: {
  canDismiss: boolean;
  onClose: () => void;
}) {
  if (!canDismiss) return null;
  return (
    <button onClick={onClose} className="bg-transparent border-0 text-xl cursor-pointer text-muted">
      <Icon name="close" />
    </button>
  );
}

const primaryButtonClass =
  "w-full bg-green text-on-green border-0 rounded-lg p-[13px] text-sm font-bold cursor-pointer mb-2.5";

const inputClass =
  "flex-1 w-full border border-border rounded-[9px] px-3.5 py-3 text-base sm:text-sm outline-none bg-surface text-text box-border";

const backButtonClass = "w-full bg-transparent border-0 text-muted text-[13px] font-bold cursor-pointer mt-1";
