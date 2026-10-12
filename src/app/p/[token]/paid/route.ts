import { NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { verifyAndConfirm } from "@/lib/proposals";

export const dynamic = "force-dynamic";

// Paystack sends the client back here after checkout. We never trust the
// redirect itself: the payment is verified with Paystack's API first.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reference = new URL(req.url).searchParams.get("reference");
  if (!reference) return NextResponse.redirect(appUrl(`/p/${token}`));
  try {
    const confirmed = await verifyAndConfirm(reference);
    return NextResponse.redirect(appUrl(`/p/${token}${confirmed ? "?paid=1" : "?failed=1"}`));
  } catch (err) {
    console.error("[paystack] callback verification failed:", err);
    return NextResponse.redirect(appUrl(`/p/${token}?failed=1`));
  }
}
