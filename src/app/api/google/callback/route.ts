import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { appUrl } from "@/lib/app-url";
import { connectGoogle } from "@/lib/google";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(appUrl("/login"));
  const params = new URL(req.url).searchParams;
  const jar = await cookies();
  const saved = jar.get("google_oauth")?.value;
  jar.delete("google_oauth");
  const { state, back } = saved ? (JSON.parse(saved) as { state: string; back: string }) : { state: null, back: "/deals/booking" };
  const safeBack = back.startsWith("/") && !back.startsWith("//") ? back : "/deals/booking";

  if (!state || params.get("state") !== state) return NextResponse.redirect(appUrl(`${safeBack}?google=state-mismatch`));
  if (params.get("error") || !params.get("code")) return NextResponse.redirect(appUrl(`${safeBack}?google=denied`));

  try {
    await connectGoogle(session.user.id, params.get("code")!);
  } catch (err) {
    console.error("[google] connect failed:", err);
    return NextResponse.redirect(appUrl(`${safeBack}?google=failed`));
  }
  return NextResponse.redirect(appUrl(`${safeBack}?google=connected`));
}
