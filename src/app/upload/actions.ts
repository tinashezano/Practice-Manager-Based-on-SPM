"use server";

import { revalidatePath } from "next/cache";
import { clientSubmit } from "@/lib/onboarding";
import { rateLimited } from "@/lib/rate-limit";

export type UploadState = { error?: string; ok?: boolean };

export async function submitItem(token: string, itemId: string, _: UploadState, fd: FormData): Promise<UploadState> {
  if (await rateLimited("upload", 60, 3_600_000)) return { error: "Too many uploads in a short time. Please try again later." };
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const answer = typeof fd.get("answer") === "string" ? (fd.get("answer") as string) : null;
  const r = await clientSubmit(token, itemId, files, answer);
  if (!r.ok) return { error: r.error };
  revalidatePath(`/upload/${token}`);
  return { ok: true };
}
