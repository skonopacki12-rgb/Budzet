"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Jasny" },
  { value: "dark", label: "Ciemny" },
  { value: "system", label: "Systemowy" },
];

const listeners = new Set<() => void>();

function getSnapshot(): Theme {
  return (localStorage.getItem("theme") as Theme | null) ?? "system";
}

function getServerSnapshot(): Theme {
  return "system";
}

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

// localStorage writes from this tab don't fire the "storage" event (only other
// tabs get that), so setTheme notifies subscribers itself; the OS-preference
// listener re-applies (and notifies) only while the stored choice is "system".
function subscribe(callback: () => void) {
  listeners.add(callback);
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const onMediaChange = () => {
    if (getSnapshot() === "system") applyTheme("system");
    callback();
  };
  window.addEventListener("storage", callback);
  mql.addEventListener("change", onMediaChange);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
    mql.removeEventListener("change", onMediaChange);
  };
}

function setTheme(theme: Theme) {
  if (theme === "system") {
    localStorage.removeItem("theme");
  } else {
    localStorage.setItem("theme", theme);
  }
  applyTheme(theme);
  listeners.forEach((listener) => listener());
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div className="flex gap-2">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setTheme(option.value)}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
            theme === option.value
              ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
              : "border-neutral-300 text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
