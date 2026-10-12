import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

describe("Paystack webhook signature", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts Paystack's HMAC-SHA512 signature and rejects anything else", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_abc");
    const { verifyWebhookSignature } = await import("@/lib/paystack");
    const body = JSON.stringify({ event: "charge.success", data: { reference: "OUT1-x" } });
    const good = createHmac("sha512", "sk_test_abc").update(body).digest("hex");
    expect(verifyWebhookSignature(body, good)).toBe(true);
    expect(verifyWebhookSignature(body + " ", good)).toBe(false);
    expect(verifyWebhookSignature(body, "deadbeef")).toBe(false);
    expect(verifyWebhookSignature(body, null)).toBe(false);
  });

  it("derives the mode from the key", async () => {
    const { paystackMode } = await import("@/lib/paystack");
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_live_x");
    expect(paystackMode()).toBe("live");
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_x");
    expect(paystackMode()).toBe("test");
    vi.stubEnv("PAYSTACK_SECRET_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(paystackMode()).toBe("off");
  });
});

describe("first retainer renewal", () => {
  it("is one month after a future start date, clamped to month end", async () => {
    const { firstRenewal } = await import("@/lib/proposals");
    expect(firstRenewal(new Date("2099-01-31T00:00:00Z"))).toBe("2099-02-28");
    expect(firstRenewal(new Date("2099-12-15T00:00:00Z"))).toBe("2100-01-15");
  });
});
