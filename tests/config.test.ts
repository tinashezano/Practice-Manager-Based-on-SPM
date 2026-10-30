import { afterEach, describe, expect, it, vi } from "vitest";
import { appUrl } from "@/lib/app-url";
import { googleKeyProblem } from "@/lib/google-config";

afterEach(() => vi.unstubAllEnvs());

describe("app links", () => {
  it("uses AUTH_URL when it is a real address", () => {
    vi.stubEnv("AUTH_URL", "https://pm.outset.co.za/");
    vi.stubEnv("RAILWAY_PUBLIC_DOMAIN", "x.up.railway.app");
    expect(appUrl("/book/discovery-call")).toBe("https://pm.outset.co.za/book/discovery-call");
  });

  it("falls back to the Railway domain when AUTH_URL is missing or localhost", () => {
    vi.stubEnv("RAILWAY_PUBLIC_DOMAIN", "practice-manager-based-on-spm-production.up.railway.app");
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
    expect(appUrl("/book/x")).toBe("https://practice-manager-based-on-spm-production.up.railway.app/book/x");
    vi.stubEnv("AUTH_URL", "");
    expect(appUrl("/book/x")).toBe("https://practice-manager-based-on-spm-production.up.railway.app/book/x");
  });
});

describe("Google keys", () => {
  it("rejects placeholder text pasted into the variables", () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "your Google Client ID from Google Cloud Credentials");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "your secret");
    expect(googleKeyProblem()).toMatch(/not a Google Client ID/);
  });

  it("accepts real-looking keys", () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "1234567890-abc123def.apps.googleusercontent.com");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "GOCSPX-abcdefghijklmnop");
    expect(googleKeyProblem()).toBeNull();
  });
});
