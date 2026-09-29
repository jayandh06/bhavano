"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => setCopied(true));
      }}
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        background: "var(--surface)",
        color: "var(--text)",
        fontSize: 12.5,
        fontWeight: 700,
        padding: "6px 10px",
        cursor: "pointer",
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
