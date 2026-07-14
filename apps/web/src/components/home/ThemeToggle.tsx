"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      title="Toggle theme"
      style={{
        background: "var(--surface-alt)",
        border: "1px solid var(--border)",
        color: "var(--text)",
        borderRadius: 8,
        width: 38,
        height: 38,
        fontSize: 16,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {mounted ? (theme === "dark" ? "☀️" : "🌙") : null}
    </button>
  );
}
