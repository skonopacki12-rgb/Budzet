"use server";

import { redirect } from "next/navigation";
import { destroyUserSession } from "@/lib/auth";

export async function signOut() {
  await destroyUserSession();
  redirect("/login");
}
