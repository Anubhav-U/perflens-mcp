"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";
const EVENT = "themechange";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function subscribe(onChange: () => void) {
  const mq = media();
  mq.addEventListener("change", onChange);
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The theme actually showing: an explicit choice if saved, otherwise the system setting. */
function getTheme(): Theme {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "light" || explicit === "dark") return explicit;
  return media().matches ? "dark" : "light";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme | null>(subscribe, getTheme, () => null);
  const next: Theme = theme === "dark" ? "light" : "dark";

  function toggle() {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private mode or blocked storage: the choice just won't persist.
    }
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme ? `Switch to ${next} theme` : "Toggle theme"}
      title={theme ? `Switch to ${next} theme` : "Toggle theme"}
      className="grid size-9 place-items-center border border-rule text-ink transition-colors hover:bg-bg-2"
    >
      {/* Half-filled circle: reads as "light/dark" without a sun/moon cliché. */}
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor" />
      </svg>
    </button>
  );
}
