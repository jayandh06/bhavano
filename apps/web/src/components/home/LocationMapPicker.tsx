"use client";

import { useEffect, useRef, useState } from "react";
import type { ReverseGeocodeResultDto } from "@bhavano/types";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { reverseGeocodeAction } from "@/app/actions/locations";

const fieldClass = "w-full border border-border rounded-[9px] px-3.5 py-3 text-sm outline-none bg-surface text-text";

/** Pin picker for the posting flow — a Places Autocomplete search box (jump the map to an
 * address) plus a draggable marker (click the map, or drag the pin, to place it precisely).
 * Every pin move calls the BFF's reverse-geocode endpoint and hands the raw lat/lng plus a
 * City/Area *suggestion* up to the caller — never auto-locks those fields itself, since
 * Google's locality boundaries won't line up perfectly with Bhavano's own Area granularity.
 * See docs/plans/google-maps-location-picker.md. */
export function LocationMapPicker({
  defaultCenter,
  onPinChange,
}: {
  defaultCenter: { lat: number; lng: number };
  onPinChange: (pin: { lat: number; lng: number }, suggestion: ReverseGeocodeResultDto | null) => void;
}) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function handlePinMove(lat: number, lng: number) {
      onPinChange({ lat, lng }, null);
      setResolving(true);
      try {
        const suggestion = await reverseGeocodeAction(lat, lng);
        if (!cancelled) onPinChange({ lat, lng }, suggestion);
      } finally {
        if (!cancelled) setResolving(false);
      }
    }

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapDivRef.current) return;

        const map = new google.maps.Map(mapDivRef.current, {
          center: defaultCenter,
          zoom: 14,
          streetViewControl: false,
          mapTypeControl: false,
        });
        const marker = new google.maps.Marker({ position: defaultCenter, map, draggable: true });
        markerRef.current = marker;

        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          if (pos) handlePinMove(pos.lat(), pos.lng());
        });

        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          marker.setPosition(e.latLng);
          handlePinMove(e.latLng.lat(), e.latLng.lng());
        });

        if (searchInputRef.current) {
          const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current);
          autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            const location = place.geometry?.location;
            if (!location) return;
            map.panTo(location);
            map.setZoom(16);
            marker.setPosition(location);
            handlePinMove(location.lat(), location.lng());
          });
        }
      })
      .catch(() => setError("Couldn't load the map — you can still pick a city/area below."));

    return () => {
      cancelled = true;
    };
    // Only ever set up once — defaultCenter changing (e.g. a later city switch) shouldn't
    // re-create the whole map instance and lose whatever pin the user already placed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <input ref={searchInputRef} placeholder="Search for an address or landmark…" autoComplete="off" className={fieldClass} />
      <div ref={mapDivRef} className="w-full h-[260px] rounded-[10px] mt-2 bg-surface-alt" />
      {resolving && <p className="text-xs text-muted mt-1.5 m-0">Looking up this location…</p>}
      {error && <p className="text-xs text-[#b3413a] mt-1.5 m-0">{error}</p>}
    </div>
  );
}
