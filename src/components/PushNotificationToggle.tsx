"use client";

import { useEffect, useState } from "react";
import { subscribePush, unsubscribePush } from "@/app/(app)/ustawienia/actions";

function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

type Status = "unsupported" | "checking" | "off" | "on" | "denied";

function initialStatus(vapidPublicKey: string | null): Status {
  if (typeof navigator === "undefined") return "checking";
  if (!vapidPublicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "checking";
}

export function PushNotificationToggle({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [status, setStatus] = useState<Status>(() => initialStatus(vapidPublicKey));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "checking") return;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setStatus(subscription ? "on" : "off"))
      .catch(() => setStatus("off"));
  }, [status]);

  async function enable() {
    if (!vapidPublicKey) return;
    setPending(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        }));
      await subscribePush(subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
      setStatus("on");
    } catch {
      setError("Nie udało się włączyć powiadomień. Spróbuj ponownie.");
    } finally {
      setPending(false);
    }
  }

  async function disable() {
    setPending(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribePush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("off");
    } catch {
      setError("Nie udało się wyłączyć powiadomień.");
    } finally {
      setPending(false);
    }
  }

  if (status === "unsupported") {
    return <p className="text-sm text-neutral-500">Ta przeglądarka nie obsługuje powiadomień push.</p>;
  }
  if (status === "checking") {
    return null;
  }
  if (status === "denied") {
    return (
      <p className="text-sm text-neutral-500">
        Powiadomienia zablokowane w przeglądarce — włącz je w ustawieniach strony, żeby móc je tu aktywować.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-neutral-500">
        {status === "on"
          ? "Dostaniesz powiadomienie o zbliżających się płatnościach cyklicznych i przekroczeniu 80% budżetu."
          : "Włącz, żeby dostawać powiadomienia o zbliżających się płatnościach cyklicznych i przekroczeniu budżetu."}
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={status === "on" ? disable : enable}
        className={
          status === "on"
            ? "rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 disabled:opacity-50"
            : "rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        }
      >
        {pending ? "Chwilka…" : status === "on" ? "Wyłącz powiadomienia" : "Włącz powiadomienia push"}
      </button>
    </div>
  );
}
