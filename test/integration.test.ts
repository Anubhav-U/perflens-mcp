import { describe, expect, it } from "vitest";
import { summarizeLhr } from "../src/core/summarize.js";
import { createAuditRunner } from "../src/runner/audit.js";

// Runs real Lighthouse against real sites. Opt in with PERFLENS_INTEGRATION=1 (needs Chrome or Edge and network).
const enabled = process.env.PERFLENS_INTEGRATION === "1";

describe.skipIf(!enabled)("real Lighthouse runs", () => {
  const runner = createAuditRunner();

  it("audits a page on mobile and desktop", async () => {
    for (const device of ["mobile", "desktop"] as const) {
      const { lhr, durationMs, browser } = await runner.audit("https://example.com/", { device });
      const summary = summarizeLhr(lhr);
      expect(summary.device).toBe(device);
      expect(summary.performanceScore).toBeGreaterThan(50);
      console.error(`${device}: score ${summary.performanceScore}, ${durationMs} ms via ${browser.source}`);
    }
  }, 240_000);

  it("reports DNS failures in plain English", async () => {
    const { lhr } = await runner.audit("https://does-not-exist.invalid/", { device: "mobile" }).catch((err) => {
      // Depending on the Lighthouse version, this throws or comes back as runtimeError.
      expect(String(err.message)).toMatch(/could not|DNS|load/i);
      return { lhr: null };
    });
    if (lhr) expect(() => summarizeLhr(lhr)).toThrow(/Lighthouse/);
  }, 120_000);
});
