import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode: modeParam } = await searchParams;
  const mode = modeParam === "signup" ? "signup" : "login";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-neutral-900">Budżet domowy</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {mode === "login" ? "Zaloguj się, aby zarządzać wspólnym budżetem." : "Załóż konto, żeby zacząć."}
        </p>
      </div>

      <AuthForm mode={mode} action={mode === "login" ? login : signup} />

      <p className="text-center text-sm text-neutral-500">
        {mode === "login" ? (
          <>
            Nie masz konta?{" "}
            <Link href="/login?mode=signup" className="text-neutral-900 underline">
              Załóż konto
            </Link>
          </>
        ) : (
          <>
            Masz już konto?{" "}
            <Link href="/login" className="text-neutral-900 underline">
              Zaloguj się
            </Link>
          </>
        )}
      </p>
    </main>
  );
}
