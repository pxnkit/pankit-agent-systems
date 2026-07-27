"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeControl() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setTheme(
        document.documentElement.dataset.theme === "dark" ? "dark" : "light",
      );
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("pxnkit-theme", next);
    } catch {
      // The preference remains active for the current page.
    }
  }

  return (
    <button
      type="button"
      className="icon-button theme-control"
      onClick={toggleTheme}
      aria-label={`Use ${theme === "dark" ? "light" : "dark"} theme`}
      title={`Use ${theme === "dark" ? "light" : "dark"} theme`}
    >
      <span aria-hidden="true">{theme === "dark" ? "◐" : "◑"}</span>
    </button>
  );
}
