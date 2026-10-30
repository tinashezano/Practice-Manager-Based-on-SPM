// Edge-safe check of the Google OAuth keys (used by sign-in and the
// Calendar/Gmail connection). Placeholder text pasted into the variables is
// treated as "not set up" so nobody gets sent to Google's error page.

const ID_FORMAT = /^[\w-]+\.apps\.googleusercontent\.com$/;

export function googleKeyProblem(): string | null {
  const id = process.env.AUTH_GOOGLE_ID?.trim() ?? "";
  const secret = process.env.AUTH_GOOGLE_SECRET?.trim() ?? "";
  if (!id && !secret) return "AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are not set.";
  if (!ID_FORMAT.test(id)) return "AUTH_GOOGLE_ID is not a Google Client ID. It should end in .apps.googleusercontent.com (copy it from Google Cloud → Credentials).";
  if (!secret || /\s/.test(secret)) return "AUTH_GOOGLE_SECRET is missing or not a real Client secret (it usually starts with GOCSPX-).";
  return null;
}

export const googleConfigured = () => googleKeyProblem() === null;
