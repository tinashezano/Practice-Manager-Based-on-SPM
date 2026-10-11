import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Railway healthcheck: confirms the app is up and can reach Postgres.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
