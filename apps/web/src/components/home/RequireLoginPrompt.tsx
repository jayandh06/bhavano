"use client";

import { useAuthGate } from "./AuthGateProvider";

export function RequireLoginPrompt({ message }: { message: string }) {
  const { requireLogin } = useAuthGate();

  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <p style={{ fontSize: 14, color: "var(--text-soft)", marginBottom: 16 }}>{message}</p>
      <button
        onClick={requireLogin}
        style={{
          background: "var(--green)",
          color: "var(--on-green)",
          border: "none",
          borderRadius: 8,
          padding: "12px 28px",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Log in
      </button>
    </div>
  );
}
