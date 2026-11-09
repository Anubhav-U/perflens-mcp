import { describe, expect, it } from "vitest";
import { PerfLensError } from "../src/core/errors.js";
import { AuditSummarySchema } from "../src/core/schema.js";
import { estimateImpact, extractEvidence, summarizeLhr } from "../src/core/summarize.js";
import { loadFixture, metric } from "./helpers.js";

describe("summarizeLhr on a slow page (news-mobile)", () => {
  const summary = summarizeLhr(loadFixture("news-mobile"));

  it("produces output that matches the public schema", () => {
    expect(() => AuditSummarySchema.parse(summary)).not.toThrow();
  });

  it("reports score, device and all five lab metrics with ratings", () => {
    expect(summary.performanceScore).toBe(16);
    expect(summary.device).toBe("mobile");
    expect(summary.metrics.map((m) => m.id)).toEqual(["LCP", "FCP", "TBT", "CLS", "SI"]);
    const lcp = summary.metrics.find((m) => m.id === "LCP")!;
    expect(lcp.value).toBe(9437);
    expect(lcp.rating).toBe("poor");
    expect(summary.metrics.find((m) => m.id === "CLS")!.rating).toBe("needs-improvement");
  });

  it("ranks opportunities by impact, highest first, capped at 10", () => {
    const impacts = summary.opportunities.map((o) => o.impact);
    expect(impacts.length).toBe(10);
    expect([...impacts].sort((a, b) => b - a)).toEqual(impacts);
    expect(summary.opportunities[0]!.impact).toBeGreaterThan(20);
  });

  it("drops a legacy audit when its insight twin also fails, keeping the larger savings", () => {
    const ids = summary.opportunities.map((o) => o.id);
    expect(ids).toContain("cls-culprits-insight");
    expect(ids).not.toContain("layout-shifts");
    const cls = summary.opportunities.find((o) => o.id === "cls-culprits-insight")!;
    // The insight itself reports CLS 0; the value comes from the legacy layout-shifts audit.
    expect(cls.metricSavings.CLS).toBeCloseTo(0.197, 3);
  });

  it("keeps a failing legacy audit when its insight twin passes", () => {
    // dom-size fails (TBT savings) while dom-size-insight passes in Lighthouse 12.8.
    expect(summary.opportunities.map((o) => o.id)).toContain("dom-size");
  });

  it("ranks small gains on a saturated metric below large ones", () => {
    const domSize = summary.opportunities.find((o) => o.id === "dom-size")!;
    const bootup = summary.opportunities.find((o) => o.id === "bootup-time")!;
    expect(bootup.impact).toBeGreaterThan(domSize.impact * 4);
  });

  it("never lists metric audits or lab-only duplicates as opportunities", () => {
    const ids = summary.opportunities.map((o) => o.id);
    for (const id of ["largest-contentful-paint", "total-blocking-time", "interactive", "max-potential-fid"]) {
      expect(ids).not.toContain(id);
    }
  });

  it("keeps at most three evidence items per opportunity and skips unattributable time", () => {
    for (const o of summary.opportunities) {
      expect(o.evidence.length).toBeLessThanOrEqual(3);
      expect(o.evidence.map((e) => e.label)).not.toContain("Unattributable");
      for (const e of o.evidence) expect(e.label.length).toBeLessThanOrEqual(160);
    }
  });

  it("respects maxOpportunities", () => {
    expect(summarizeLhr(loadFixture("news-mobile"), { maxOpportunities: 3 }).opportunities).toHaveLength(3);
  });
});

describe("summarizeLhr on fast pages", () => {
  it("detects desktop runs from configSettings", () => {
    const s = summarizeLhr(loadFixture("mdn-desktop"));
    expect(s.device).toBe("desktop");
    expect(s.metrics.every((m) => m.rating === "good")).toBe(true);
  });

  it("gives tiny impact to minor findings on a perfect page", () => {
    const s = summarizeLhr(loadFixture("example-mobile"));
    expect(s.performanceScore).toBe(100);
    for (const o of s.opportunities) expect(o.impact).toBeLessThanOrEqual(1);
  });
});

describe("summarizeLhr errors", () => {
  it("throws a readable error when Lighthouse reports a runtime error", () => {
    const lhr = { ...loadFixture("example-mobile"), runtimeError: { code: "NO_FCP", message: "The page did not paint." } };
    expect(() => summarizeLhr(lhr)).toThrow(PerfLensError);
    expect(() => summarizeLhr(lhr)).toThrow("The page never painted any content. It may be blank, blocked for automated browsers, or require login. (Lighthouse NO_FCP)");
  });

  it("throws when the performance category is missing", () => {
    const lhr = { ...loadFixture("example-mobile"), categories: {} };
    expect(() => summarizeLhr(lhr)).toThrow(/no performance category/);
  });

  it("warns instead of failing when a metric is missing", () => {
    const lhr = loadFixture("example-mobile");
    delete (lhr.audits as Record<string, unknown>)["speed-index"];
    const s = summarizeLhr(lhr);
    expect(s.metrics.map((m) => m.id)).not.toContain("SI");
    expect(s.warnings.join(" ")).toMatch(/Speed Index was not measured/);
  });
});

describe("estimateImpact", () => {
  const poorLcp = [metric("LCP", 6500, 10)];

  it("scales with the share of the gap to 'good' that the savings close", () => {
    // gap = 6500 - 2500 = 4000; points lost = 25 * 0.9 = 22.5
    expect(estimateImpact({ LCP: 2000 }, undefined, poorLcp, "mobile")).toBeCloseTo(11.3, 1);
    expect(estimateImpact({ LCP: 8000 }, undefined, poorLcp, "mobile")).toBeCloseTo(22.5, 1);
  });

  it("ignores savings on metrics that are already good", () => {
    expect(estimateImpact({ LCP: 500 }, undefined, [metric("LCP", 2000, 98)], "mobile")).toBe(0.5);
  });

  it("gives byte-only savings a small capped value", () => {
    expect(estimateImpact({}, 512 * 1024, poorLcp, "mobile")).toBe(0.5);
    expect(estimateImpact({}, 50 * 1024 * 1024, poorLcp, "mobile")).toBe(3);
  });
});

describe("extractEvidence", () => {
  it("flattens nested tables in list details and reads entity, node and time fields", () => {
    const evidence = extractEvidence({
      id: "x",
      title: "x",
      score: 0,
      scoreDisplayMode: "metricSavings",
      details: {
        type: "list",
        items: [
          { type: "checklist", items: {} },
          {
            type: "table",
            items: [
              { node: { selector: "img.hero" } },
              { entity: "Ad Network", blockingTime: 900.4, transferSize: 2048 },
              { url: "https://cdn.test/app.js", wastedBytes: 1000.6, totalBytes: 5000 },
              { url: "https://cdn.test/more.js" },
            ],
          },
        ],
      },
    });
    expect(evidence).toEqual([
      { label: "img.hero" },
      { label: "Ad Network", timeMs: 900, totalBytes: 2048 },
      { label: "https://cdn.test/app.js", wastedBytes: 1001, totalBytes: 5000 },
    ]);
  });

  it("returns nothing when an audit has no details", () => {
    expect(extractEvidence({ id: "x", title: "x", score: 0, scoreDisplayMode: "binary" })).toEqual([]);
  });
});
