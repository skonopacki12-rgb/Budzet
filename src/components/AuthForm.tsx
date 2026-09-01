"use client";

import { useActionState } from "react";
import type { AuthActionState } from "@/app/login/actions";

export function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "signup";
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
        Adres e-mail
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="ty@przyklad.pl"
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-base outline-none focus:border-neutral-900 dark:focus:border-neutral-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
        Hasło
        <input
          type="password"
          name="password"
          required
          minLength={mode === "signup" ? 8 : undefined}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder={mode === "signup" ? "min. 8 znaków" : "••••••••"}
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-base outline-none focus:border-neutral-900 dark:focus:border-neutral-100"
        />
      </label>
      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-neutral-900 dark:bg-neutral-100 px-3 py-2.5 text-sm font-medium text-white dark:text-neutral-900 disabled:opacity-50"
      >
        {pending ? "Chwileczkę…" : mode === "login" ? "Zaloguj się" : "Załóż konto"}
      </button>
    </form>
  );
}
