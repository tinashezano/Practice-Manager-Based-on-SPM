import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-safe part of the auth config (used by middleware). Anything touching
// the database lives in src/auth.ts.
export const authConfig = {
  pages: { signIn: "/login" },
  // Railway (and local dev) always sit behind a proxy that sets the Host header.
  trustHost: true,
  session: { strategy: "jwt" },
  // Google sign-in switches on once AUTH_GOOGLE_ID is set; until then staff use passwords.
  providers: process.env.AUTH_GOOGLE_ID
    ? [
        Google({
          authorization: {
            params: {
              // Pre-selects the firm's Workspace domain in Google's account picker.
              // Enforced server-side in the signIn callback as well.
              hd: process.env.ALLOWED_EMAIL_DOMAIN,
              prompt: "select_account",
            },
          },
        }),
      ]
    : [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      // Public: sign-in, health check, lead-facing booking pages, the enquiry form,
      // client proposal pages (and their pictures/brochures) and the Paystack
      // webhook (verified by signature).
      const isPublic =
        pathname === "/login" ||
        pathname.startsWith("/api/auth") ||
        pathname === "/api/health" ||
        pathname === "/enquiry" ||
        pathname.startsWith("/book/") ||
        pathname.startsWith("/p/") ||
        pathname.startsWith("/api/assets/") ||
        pathname.startsWith("/upload/") ||
        pathname === "/api/paystack/webhook";
      if (isPublic) return true;
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
