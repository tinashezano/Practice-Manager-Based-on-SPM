import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { appUrl } from "@/lib/app-url";
import { randomToken } from "@/lib/crypto";
import { googleAuthUrl, googleConfigured } from "@/lib/google";

// Starts the "Connect Google Calendar & Gmail" flow for the signed-in user.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(appUrl("/login"));
  const back = new URL(req.url).searchParams.get("back") ?? "/deals/booking";
  if (!googleConfigured()) return NextResponse.redirect(appUrl(`${back}?google=not-configured`));

  const state = randomToken();
  (await cookies()).set("google_oauth", JSON.stringify({ state, back }), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });
  return NextResponse.redirect(googleAuthUrl(state, session.user.email ?? undefined));
}
