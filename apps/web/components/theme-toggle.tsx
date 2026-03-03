"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    const root = document.documentElement;
    const current = (root.getAttribute("data-theme") as "dark" | "light" | null) ?? "light";
    setTheme(current);
  }, []);

  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="btn"
      aria-label="Toggle theme"
      onClick={() => {
        const root = document.documentElement;
        root.setAttribute("data-theme", next);
        localStorage.setItem("ai_theme", next);
        localStorage.setItem("theme", next);
        setTheme(next);
      }}
    >
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
