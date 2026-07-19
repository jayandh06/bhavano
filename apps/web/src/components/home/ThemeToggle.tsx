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
      className="bg-surface-alt border border-border text-text rounded-lg w-[38px] h-[38px] text-base cursor-pointer flex items-center justify-center"
    >
      {mounted ? (theme === "dark" ? "☀️" : "🌙") : null}
    </button>
  );
}
