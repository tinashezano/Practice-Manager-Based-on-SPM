import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { rateLimited } from "@/lib/rate-limit";

export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID);

export const devLoginEnabled =
  process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN_ENABLED === "true";

function emailAllowed(email: string) {
  const domain = process.env.ALLOWED_EMAIL_DOMAIN;
  return !domain || email.toLowerCase().endsWith(`@${domain.toLowerCase()}`);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    // Email + password for staff a Director has given a password.
    Credentials({
      id: "password",
      name: "Email and password",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(credentials) {
        // 10 attempts per 15 minutes per IP slows down password guessing.
        if (await rateLimited("login", 10, 15 * 60_000)) return null;
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        const user = await db.user.findUnique({ where: { email } });
        if (!user?.active || !(await verifyPassword(password, user.passwordHash))) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev",
            name: "Development login",
            credentials: { email: { label: "Email", type: "email" } },
            async authorize(credentials) {
              const email = String(credentials?.email ?? "").toLowerCase();
              const user = await db.user.findUnique({ where: { email } });
              return user?.active ? { id: user.id, email: user.email, name: user.name } : null;
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Only staff that a Director has added (and not deactivated) may sign in.
    async signIn({ user, account, profile }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      if (account?.provider === "google") {
        if (!profile?.email_verified || !emailAllowed(email)) return "/login?error=domain";
      }
      const staff = await db.user.findUnique({ where: { email } });
      if (!staff?.active) return "/login?error=not-invited";
      await db.user.update({
        where: { id: staff.id },
        data: { lastLoginAt: new Date(), image: staff.image ?? user.image ?? null },
      });
      return true;
    },
    // Re-read role on every request so role changes and deactivations apply immediately.
    async jwt({ token }) {
      if (!token.email) return token;
      const staff = await db.user.findUnique({ where: { email: token.email.toLowerCase() } });
      if (!staff?.active) return null;
      token.uid = staff.id;
      token.role = staff.role;
      token.name = staff.name;
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.uid!;
      session.user.role = token.role!;
      return session;
    },
  },
});
