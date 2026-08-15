"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleMagicLink(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("sent");
  }

  async function handleOAuth(provider: "google" | "apple") {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-neutral-900">Budżet domowy</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Zaloguj się, aby zarządzać wspólnym budżetem.
        </p>
      </div>

      {status === "sent" ? (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Wysłaliśmy link logowania na adres <strong>{email}</strong>. Otwórz go na tym urządzeniu.
        </div>
      ) : (
        <form onSubmit={handleMagicLink} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Adres e-mail
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ty@przyklad.pl"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
            />
          </label>
          <button
            type="submit"
            disabled={status === "sending"}
            className="rounded-lg bg-neutral-900 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {status === "sending" ? "Wysyłanie…" : "Wyślij link logowania"}
          </button>
          {status === "error" && <p className="text-sm text-red-600">{errorMessage}</p>}
        </form>
      )}

      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" />
        lub
        <div className="h-px flex-1 bg-neutral-200" />
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={() => handleOAuth("google")}
          className="rounded-lg border border-neutral-300 px-3 py-2.5 text-sm font-medium text-neutral-800"
        >
          Kontynuuj z Google
        </button>
        <button
          onClick={() => handleOAuth("apple")}
          className="rounded-lg border border-neutral-300 px-3 py-2.5 text-sm font-medium text-neutral-800"
        >
          Kontynuuj z Apple
        </button>
      </div>
    </main>
  );
}
