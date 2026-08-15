import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveHousehold } from "@/lib/household";
import { BottomNav } from "@/components/BottomNav";
import { InstallHint } from "@/components/InstallHint";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const household = await getActiveHousehold(supabase, user.id);
  if (!household) redirect("/onboarding");

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-xs text-neutral-400">Gospodarstwo domowe</p>
          <p className="text-sm font-medium text-neutral-900">{household.name}</p>
        </div>
      </header>
      <InstallHint />
      <main className="flex-1 px-4 pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
