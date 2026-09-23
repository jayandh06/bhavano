"use client";

import { useEffect } from "react";
import { reportClientErrorAction } from "@/app/actions/clientErrors";

// Renamed from the original "GlobalError" now that a real global-error.tsx exists (Next's
// root-layout-level boundary, which this segment-level one cannot catch) — this file's own name
// was misleadingly close to that.
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Fires once per shown error, not on every re-render of the fallback itself (reset() remounts
  // the segment rather than this component, so a fresh error re-triggers a fresh effect run).
  useEffect(() => {
    void reportClientErrorAction({
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-5 bg-bg text-text">
      <p className="text-sm text-text-soft mb-4">Something went wrong. Please try again.</p>
      <button
        onClick={reset}
        className="bg-green text-on-green border-0 rounded-lg px-7 py-3 text-sm font-bold cursor-pointer"
      >
        Try again
      </button>
    </div>
  );
}
