"use client";

import { useEffect } from "react";
import { reportClientErrorAction } from "@/app/actions/clientErrors";

/** Admin had no error boundary at all until now — a render crash previously just showed Next's
 * default unstyled error screen with nothing recorded. Mirrors web's error.tsx, but with inline
 * styles (matching every other admin page's convention, e.g. app/page.tsx) since admin has no
 * `@theme inline` Tailwind token mapping the way web does. See
 * docs/plans/client-error-reporting-loki-grafana.md. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "0 20px",
        background: "var(--bg)",
        color: "var(--text)",
      }}
    >
      <p style={{ fontSize: 14, color: "var(--text-soft)", marginBottom: 16 }}>
        Something went wrong. Please try again.
      </p>
      <button
        onClick={reset}
        style={{
          background: "var(--green)",
          color: "var(--on-green)",
          border: 0,
          borderRadius: 8,
          padding: "12px 28px",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}
