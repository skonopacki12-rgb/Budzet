"use client";

import { useState } from "react";

// The vision model only accepts images as a JSON array of byte values, which
// inflates the payload ~3-4x over the raw file — a normal phone photo (often
// several MB) blows past Workers AI's request size limit ("3006: Request is
// too large") once encoded that way. Downscaling client-side before upload
// keeps the array small while staying legible enough for receipt text.
const MAX_DIMENSION = 1400;
const JPEG_QUALITY = 0.75;

async function resizeImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Przeglądarka nie obsługuje przetwarzania zdjęć.");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Nie udało się przetworzyć zdjęcia."))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });

  return new File([blob], "paragon.jpg", { type: "image/jpeg" });
}

export function ReceiptUploadForm({ action }: { action: (formData: FormData) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("image") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    setPending(true);
    setError(null);
    try {
      const resized = await resizeImage(file);
      const formData = new FormData();
      formData.set("image", resized);
      await action(formData);
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : "Nie udało się przetworzyć zdjęcia.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
        Zdjęcie paragonu
        <input
          name="image"
          type="file"
          accept="image/*"
          required
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2.5 text-sm outline-none focus:border-neutral-900 dark:focus:border-neutral-100"
        />
      </label>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-neutral-900 dark:bg-neutral-100 px-3 py-3 text-sm font-medium text-white dark:text-neutral-900 disabled:opacity-50"
      >
        {pending ? "Analizuję paragon… (może potrwać kilkanaście sekund)" : "Analizuj paragon"}
      </button>
    </form>
  );
}
