"use client";

import { useEffect } from "react";
import { reportClientErrorAction } from "@/app/actions/clientErrors";

/** Next's root-layout-level error boundary — the one class of crash error.tsx cannot catch (a
 * throw inside the root layout itself). Must render its own <html>/<body>, since this replaces
 * the entire root layout rather than one segment within it. See
 * docs/plans/client-error-reporting-loki-grafana.md. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
    <html lang="en">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "0 20px",
          }}
        >
          <p style={{ fontSize: 14, color: "#6b6b6b", marginBottom: 16 }}>
            Something went wrong. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#0b3d2e",
              color: "#efe9dc",
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
      </body>
    </html>
  );
}
