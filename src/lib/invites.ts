import { createHash } from "node:crypto";
import { appUrl } from "@/lib/app-url";
import { randomToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { inviteEmail, queueEmail } from "@/lib/email";
import { getFirmSettings } from "@/lib/firm";
import { hashPassword, passwordProblem } from "@/lib/password";

// "Set up your account" links for new staff. Only a hash of the token is
// stored; a new invite replaces the old link, and it expires after 7 days.

const DAYS = 7;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a fresh invite link and emails it from the inviter's Gmail. Returns the link (to copy as a backup). */
export async function sendInvite(userId: string, inviter: { id: string; name: string }) {
  const token = randomToken(32);
  const user = await db.user.update({
    where: { id: userId },
    data: { inviteTokenHash: hash(token), inviteExpiresAt: new Date(Date.now() + DAYS * 86_400_000) },
  });
  const url = appUrl(`/welcome/${token}`);
  const firm = await getFirmSettings();
  await queueEmail({ to: user.email, ...inviteEmail({ name: user.name, inviterName: inviter.name, firmName: firm.legalName, url, days: DAYS }), senderId: inviter.id });
  return url;
}

export async function findInvite(token: string) {
  if (!token || token.length > 100) return null;
  const user = await db.user.findUnique({ where: { inviteTokenHash: hash(token) } });
  if (!user?.active || !user.inviteExpiresAt || user.inviteExpiresAt < new Date()) return null;
  return user;
}

/** The new team member chooses their password; the link then stops working. */
export async function acceptInvite(token: string, password: string): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const user = await findInvite(token);
  if (!user) return { ok: false, error: "This invite link has expired or was already used. Ask a Director to send a new one." };
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };
  const { count } = await db.user.updateMany({
    where: { id: user.id, inviteTokenHash: user.inviteTokenHash },
    data: { passwordHash: await hashPassword(password), inviteTokenHash: null, inviteExpiresAt: null },
  });
  return count ? { ok: true, email: user.email } : { ok: false, error: "This invite link was already used." };
}
