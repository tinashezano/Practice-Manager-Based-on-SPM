import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

describe("video embeds", () => {
  it("embeds YouTube, Loom and Vimeo and ignores anything else", async () => {
    const { embedUrl } = await import("@/lib/resource-meta");
    expect(embedUrl("https://www.youtube.com/watch?v=abc123")).toBe("https://www.youtube-nocookie.com/embed/abc123");
    expect(embedUrl("https://youtu.be/abc123")).toBe("https://www.youtube-nocookie.com/embed/abc123");
    expect(embedUrl("https://www.loom.com/share/0f1e2d")).toBe("https://www.loom.com/embed/0f1e2d");
    expect(embedUrl("https://vimeo.com/12345")).toBe("https://player.vimeo.com/video/12345");
    expect(embedUrl("https://evil.example.com/x")).toBeNull();
    expect(embedUrl("javascript:alert(1)")).toBeNull();
    expect(embedUrl("not a url")).toBeNull();
  });
});

describe("search excerpts", () => {
  it("shows the text around the match without markdown symbols", async () => {
    const { excerpt } = await import("@/lib/resources");
    const body = "## Steps\n1. Run the **VAT report** for the period.\n2. Reconcile output VAT to sales.";
    expect(excerpt(body, "reconcile")).toContain("Reconcile output VAT");
    expect(excerpt(body)).not.toContain("**");
  });
});
