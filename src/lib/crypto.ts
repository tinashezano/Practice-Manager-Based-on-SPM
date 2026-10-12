import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Encrypts secrets at rest (e.g. Google refresh tokens) with AES-256-GCM.
// The key is derived from AUTH_SECRET, so rotating AUTH_SECRET means staff
// reconnect their Google accounts.
function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(`outset-pm:secrets:${secret}`).digest();
}

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(token: string) {
  const [iv, tag, data] = token.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv!);
  decipher.setAuthTag(tag!);
  return Buffer.concat([decipher.update(data!), decipher.final()]).toString("utf8");
}

export function randomToken(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}
