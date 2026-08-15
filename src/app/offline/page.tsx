export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold text-neutral-900">Brak połączenia</h1>
      <p className="text-sm text-neutral-500">
        Nie widzimy internetu. Wcześniej wczytane dane zostaną odświeżone, gdy tylko połączenie wróci.
      </p>
    </main>
  );
}
