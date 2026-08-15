"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Plus, Receipt, Wallet, Settings } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Pulpit", icon: LayoutDashboard },
  { href: "/budzet", label: "Budżet", icon: Wallet },
  { href: "/dodaj", label: "Dodaj", icon: Plus },
  { href: "/paragony", label: "Paragony", icon: Receipt },
  { href: "/ustawienia", label: "Ustawienia", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const isAdd = href === "/dodaj";
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-xs ${
                  isAdd
                    ? "text-white"
                    : active
                      ? "text-neutral-900 font-medium"
                      : "text-neutral-400"
                }`}
              >
                <span
                  className={
                    isAdd
                      ? "flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 -mt-4 shadow-lg"
                      : "flex h-6 w-6 items-center justify-center"
                  }
                >
                  <Icon size={isAdd ? 20 : 20} strokeWidth={active && !isAdd ? 2.5 : 2} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
