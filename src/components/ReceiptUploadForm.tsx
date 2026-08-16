"use client";

import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-neutral-900 px-3 py-3 text-sm font-medium text-white disabled:opacity-50"
    >
      {pending ? "Analizuję paragon… (może potrwać kilkanaście sekund)" : "Analizuj paragon"}
    </button>
  );
}

export function ReceiptUploadForm({ action }: { action: (formData: FormData) => void }) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Zdjęcie paragonu
        <input
          name="image"
          type="file"
          accept="image/*"
          capture="environment"
          required
          className="rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-900"
        />
      </label>
      <SubmitButton />
    </form>
  );
}
