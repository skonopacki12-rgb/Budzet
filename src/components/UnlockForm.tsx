"use client";

import { useActionState } from "react";
import type { UnlockActionState } from "@/app/odblokuj/actions";

export function UnlockForm({
  action,
}: {
  action: (state: UnlockActionState, formData: FormData) => Promise<UnlockActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        PIN
        <input
          type="password"
          name="pin"
          inputMode="numeric"
          pattern="\d{4,6}"
          autoFocus
          required
          placeholder="••••"
          className="rounded-lg border border-neutral-300 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-neutral-900"
        />
      </label>
      {state?.error && <p className="text-center text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Sprawdzam…" : "Odblokuj"}
      </button>
    </form>
  );
}
