"use server";

import { redirect } from "next/navigation";
import { acceptInvite } from "@/lib/invites";
import { rateLimited } from "@/lib/rate-limit";

export type WelcomeState = { error?: string };

export async function setupAccount(token: string, _: WelcomeState, fd: FormData): Promise<WelcomeState> {
  if (await rateLimited("welcome", 10, 15 * 60_000)) return { error: "Too many attempts. Try again in 15 minutes." };
  const password = String(fd.get("password") ?? "");
  if (password !== String(fd.get("confirm") ?? "")) return { error: "The passwords don't match." };
  const r = await acceptInvite(token, password);
  if (!r.ok) return { error: r.error };
  redirect(`/login?welcome=1&email=${encodeURIComponent(r.email)}`);
}
