"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const DISMISSED_KEY = "budzet:install-hint-dismissed";

export function InstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const dismissed = window.localStorage.getItem(DISMISSED_KEY) === "1";

    // Browser-only check (userAgent, matchMedia) that can't run during SSR,
    // so it has to happen after mount rather than during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(isIos && !isStandalone && !dismissed);
  }, []);

  if (!visible) return null;

  return (
    <div className="mx-4 mb-3 flex items-start gap-2.5 rounded-xl bg-teal-50 px-3 py-2.5 text-xs text-teal-900">
      <Share size={16} className="mt-0.5 shrink-0" />
      <p className="flex-1">
        Zainstaluj aplikację: stuknij <strong>Udostępnij</strong> na dole ekranu, a potem{" "}
        <strong>Dodaj do ekranu początkowego</strong>.
      </p>
      <button
        onClick={() => {
          window.localStorage.setItem(DISMISSED_KEY, "1");
          setVisible(false);
        }}
        aria-label="Zamknij"
        className="shrink-0 text-teal-700"
      >
        <X size={16} />
      </button>
    </div>
  );
}
